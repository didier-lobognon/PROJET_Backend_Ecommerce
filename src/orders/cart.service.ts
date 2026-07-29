import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { CartAbandonmentService } from '../notifications/cart-abandonment.service';
import { serializeProduct } from '../common/utils/product.utils';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  GUEST_CART_PREFIX,
  GUEST_CART_TTL_SECONDS,
} from './orders.constants';

export interface GuestCartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  productSlug: string;
  productReference: string;
  imageUrl?: string;
}

export interface CartItemResponse {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: {
    id: string;
    name: string;
    slug: string;
    reference: string;
    stock: number;
    status: ProductStatus;
    imageUrl?: string;
  };
}

export interface CartResponse {
  items: CartItemResponse[];
  itemCount: number;
  subtotal: number;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mediaService: MediaService,
    private readonly cartAbandonment: CartAbandonmentService,
  ) {}

  async getCart(sessionId?: string, userId?: string): Promise<CartResponse> {
    if (userId) {
      await this.mergeGuestCartIfNeeded(sessionId, userId);
      return this.getDbCart(userId);
    }
    if (sessionId) {
      return this.getGuestCart(sessionId);
    }
    return this.emptyCart();
  }

  async addItem(
    productId: string,
    quantity: number,
    sessionId?: string,
    userId?: string,
  ): Promise<CartResponse> {
    const product = await this.validateProduct(productId);

    if (userId) {
      await this.mergeGuestCartIfNeeded(sessionId, userId);
      return this.addToDbCart(userId, product, quantity);
    }
    if (!sessionId) {
      throw new BadRequestException('Session panier requise');
    }
    return this.addToGuestCart(sessionId, product, quantity);
  }

  async updateItemQuantity(
    productId: string,
    quantity: number,
    sessionId?: string,
    userId?: string,
  ): Promise<CartResponse> {
    if (userId) {
      await this.mergeGuestCartIfNeeded(sessionId, userId);
      return this.updateDbCartItem(userId, productId, quantity);
    }
    if (!sessionId) {
      throw new BadRequestException('Session panier requise');
    }
    return this.updateGuestCartItem(sessionId, productId, quantity);
  }

  async removeItem(
    productId: string,
    sessionId?: string,
    userId?: string,
  ): Promise<CartResponse> {
    if (userId) {
      await this.mergeGuestCartIfNeeded(sessionId, userId);
      return this.removeFromDbCart(userId, productId);
    }
    if (!sessionId) {
      throw new BadRequestException('Session panier requise');
    }
    return this.removeFromGuestCart(sessionId, productId);
  }

  async clearCart(sessionId?: string, userId?: string): Promise<CartResponse> {
    if (userId) {
      await this.mergeGuestCartIfNeeded(sessionId, userId);
      const cart = await this.getOrCreateDbCart(userId);
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      await this.cartAbandonment.cancelForUser(userId);
      return this.getDbCart(userId);
    }
    if (sessionId) {
      await this.redis.del(`${GUEST_CART_PREFIX}${sessionId}`);
    }
    return this.emptyCart();
  }

  private async mergeGuestCartIfNeeded(
    sessionId: string | undefined,
    userId: string,
  ): Promise<void> {
    if (!sessionId) return;
    await this.mergeGuestCart(sessionId, userId);
  }

  async mergeGuestCart(sessionId: string, userId: string): Promise<void> {
    const guestItems = await this.getGuestCartRaw(sessionId);
    if (guestItems.length === 0) return;

    for (const item of guestItems) {
      try {
        const product = await this.validateProduct(item.productId);
        await this.addToDbCart(userId, product, item.quantity);
      } catch {
        // skip invalid products from guest cart
      }
    }

    await this.redis.del(`${GUEST_CART_PREFIX}${sessionId}`);
  }

  async getCartItemsForCheckout(sessionId?: string, userId?: string) {
    const cart = await this.getCart(sessionId, userId);
    if (cart.items.length === 0) {
      throw new BadRequestException('Le panier est vide');
    }
    return cart;
  }

  private async getGuestCartRaw(sessionId: string): Promise<GuestCartItem[]> {
    const raw = await this.redis.get(`${GUEST_CART_PREFIX}${sessionId}`);
    if (!raw) return [];
    return JSON.parse(raw) as GuestCartItem[];
  }

  private async saveGuestCart(sessionId: string, items: GuestCartItem[]): Promise<void> {
    await this.redis.set(
      `${GUEST_CART_PREFIX}${sessionId}`,
      JSON.stringify(items),
      GUEST_CART_TTL_SECONDS,
    );
  }

  private async getGuestCart(sessionId: string): Promise<CartResponse> {
    const items = await this.getGuestCartRaw(sessionId);
    return this.formatGuestCart(items);
  }

  private async addToGuestCart(
    sessionId: string,
    product: Awaited<ReturnType<typeof this.validateProduct>>,
    quantity: number,
  ): Promise<CartResponse> {
    const items = await this.getGuestCartRaw(sessionId);
    const image = product.images[0];
    const existing = items.find((i) => i.productId === product.id);

    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > product.stock) {
        throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
      }
    } else {
      if (quantity > product.stock) {
        throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
      }
      items.push({
        productId: product.id,
        quantity,
        unitPrice: product.price.toNumber(),
        productName: product.name,
        productSlug: product.slug,
        productReference: product.reference,
        imageUrl: image ? this.mediaService.resolveUrl(image.url) : undefined,
      });
    }

    await this.saveGuestCart(sessionId, items);
    return this.formatGuestCart(items);
  }

  private async updateGuestCartItem(
    sessionId: string,
    productId: string,
    quantity: number,
  ): Promise<CartResponse> {
    const product = await this.validateProduct(productId);
    const items = await this.getGuestCartRaw(sessionId);
    const item = items.find((i) => i.productId === productId);
    if (!item) {
      throw new NotFoundException('Article introuvable dans le panier');
    }
    if (quantity > product.stock) {
      throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
    }
    item.quantity = quantity;
    await this.saveGuestCart(sessionId, items);
    return this.formatGuestCart(items);
  }

  private async removeFromGuestCart(
    sessionId: string,
    productId: string,
  ): Promise<CartResponse> {
    const items = (await this.getGuestCartRaw(sessionId)).filter(
      (i) => i.productId !== productId,
    );
    await this.saveGuestCart(sessionId, items);
    return this.formatGuestCart(items);
  }

  private formatGuestCart(items: GuestCartItem[]): CartResponse {
    const formatted: CartItemResponse[] = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
      product: {
        id: item.productId,
        name: item.productName,
        slug: item.productSlug,
        reference: item.productReference,
        stock: 0,
        status: ProductStatus.AVAILABLE,
        imageUrl: item.imageUrl,
      },
    }));

    return this.buildCartResponse(formatted);
  }

  private async getDbCart(userId: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { images: { orderBy: { order: 'asc' }, take: 1 } },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return this.emptyCart();
    }

    const formatted: CartItemResponse[] = cart.items.map((item) => {
      const serialized = serializeProduct(item.product);
      const image = item.product.images[0];
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.unitPrice.toNumber() * item.quantity,
        product: {
          id: serialized.id,
          name: serialized.name,
          slug: serialized.slug,
          reference: serialized.reference,
          stock: serialized.stock,
          status: serialized.status,
          imageUrl: image ? this.mediaService.resolveUrl(image.url) : undefined,
        },
      };
    });

    return this.buildCartResponse(formatted);
  }

  private async addToDbCart(
    userId: string,
    product: Awaited<ReturnType<typeof this.validateProduct>>,
    quantity: number,
  ): Promise<CartResponse> {
    const cart = await this.getOrCreateDbCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    });

    const newQty = (existing?.quantity ?? 0) + quantity;
    if (newQty > product.stock) {
      throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty, unitPrice: product.price },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          quantity,
          unitPrice: product.price,
        },
      });
    }

    await this.cartAbandonment.scheduleForUser(userId).catch(() => undefined);
    return this.getDbCart(userId);
  }

  private async updateDbCartItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartResponse> {
    const product = await this.validateProduct(productId);
    const cart = await this.getOrCreateDbCart(userId);

    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    if (!item) {
      throw new NotFoundException('Article introuvable dans le panier');
    }
    if (quantity > product.stock) {
      throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity, unitPrice: product.price },
    });

    await this.cartAbandonment.scheduleForUser(userId).catch(() => undefined);
    return this.getDbCart(userId);
  }

  private async removeFromDbCart(userId: string, productId: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    }
    await this.cartAbandonment.scheduleForUser(userId).catch(() => undefined);
    return this.getDbCart(userId);
  }

  private async getOrCreateDbCart(userId: string) {
    const expiresAt = new Date(Date.now() + GUEST_CART_TTL_SECONDS * 1000);
    return this.prisma.cart.upsert({
      where: { userId },
      update: { expiresAt },
      create: { userId, expiresAt },
    });
  }

  private async validateProduct(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null, status: ProductStatus.AVAILABLE },
      include: { images: { orderBy: { order: 'asc' }, take: 1 } },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable ou indisponible');
    }
    if (product.stock <= 0) {
      throw new BadRequestException('Produit en rupture de stock');
    }
    return product;
  }

  private buildCartResponse(items: CartItemResponse[]): CartResponse {
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    return { items, itemCount, subtotal };
  }

  private emptyCart(): CartResponse {
    return { items: [], itemCount: 0, subtotal: 0 };
  }
}
