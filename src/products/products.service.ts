import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductMovementType } from '@prisma/client';
import { serializeProduct, slugify, buildProductReferenceBase, resolveProductStatusFromStock } from '../common/utils/product.utils';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'catalog:products';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mediaService: MediaService,
  ) {}

  async findAll(query: ProductQueryDto) {
    const cacheKey = `${CACHE_PREFIX}:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.location) {
      where.location = { contains: query.location, mode: 'insensitive' };
    }

    if (query.categorySlug) {
      where.category = { slug: query.categorySlug };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = query.maxPrice;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { order: 'asc' } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      data: items.map((p) => this.formatProduct(p)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(result), CACHE_TTL);
    return result;
  }

  async findBySlug(slug: string) {
    const cacheKey = `${CACHE_PREFIX}:slug:${slug}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { order: 'asc' } },
      },
    });

    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    const formatted = this.formatProduct(product);
    await this.redis.set(cacheKey, JSON.stringify(formatted), CACHE_TTL);
    return formatted;
  }

  async findMovements(productId: string) {
    await this.ensureExists(productId);
    return this.prisma.productMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateProductDto) {
    const slug = slugify(dto.name);
    const stock = dto.stock ?? 0;
    const reference = dto.reference?.trim() || (await this.generateReference(dto.name));
    const status = resolveProductStatusFromStock(stock);

    const existing = await this.prisma.product.findFirst({
      where: { OR: [{ slug }, { reference }] },
    });
    if (existing) {
      throw new ConflictException('Un produit avec ce nom ou cette référence existe déjà');
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: dto.name,
          slug,
          reference,
          description: dto.description,
          price: dto.price,
          discountPrice: dto.discountPrice ?? null,
          stock,
          status,
          categoryId: dto.categoryId,
          dimensions: dto.dimensions,
          weight: dto.weight,
          location: dto.location,
          images: dto.images?.length
            ? {
                create: dto.images.map((img, index) => ({
                  url: this.mediaService.resolveUrl(img.url),
                  alt: img.alt ?? dto.name,
                  order: img.order ?? index,
                })),
              }
            : {
                create: {
                  url: this.mediaService.getPlaceholderUrl(dto.name),
                  alt: dto.name,
                  order: 0,
                },
              },
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { order: 'asc' } },
        },
      });

      await tx.productMovement.create({
        data: {
          productId: created.id,
          type: ProductMovementType.IN,
          quantity: stock,
          note: 'Stock initial',
        },
      });

      return created;
    });

    await this.invalidateCache();
    return this.formatProduct(product);
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { images: true },
    });
    if (!existing) {
      throw new NotFoundException('Produit introuvable');
    }

    const nextStock = dto.stock !== undefined ? dto.stock : existing.stock;
    const data: Prisma.ProductUpdateInput = {
      description: dto.description,
      price: dto.price,
      discountPrice: dto.discountPrice !== undefined ? (dto.discountPrice ?? null) : undefined,
      stock: dto.stock,
      status: resolveProductStatusFromStock(nextStock),
      dimensions: dto.dimensions,
      weight: dto.weight,
      location: dto.location,
    };

    if (dto.name) {
      data.name = dto.name;
      data.slug = slugify(dto.name);
    }

    if (dto.reference) {
      data.reference = dto.reference;
    }

    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.images !== undefined) {
      const nextUrls = new Set(
        dto.images.map((img) => this.mediaService.resolveUrl(img.url)),
      );

      for (const image of existing.images) {
        const resolved = this.mediaService.resolveUrl(image.url);
        if (!nextUrls.has(resolved) && !nextUrls.has(image.url)) {
          await this.deleteMediaUrl(image.url);
        }
      }

      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      data.images = {
        create: dto.images.map((img, index) => ({
          url: this.mediaService.resolveUrl(img.url),
          alt: img.alt ?? dto.name ?? existing.name,
          order: img.order ?? index,
        })),
      };
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { order: 'asc' } },
      },
    });

    if (dto.stock !== undefined) {
      await this.prisma.productMovement.create({
        data: {
          productId: id,
          type: ProductMovementType.ADJUSTMENT,
          quantity: dto.stock,
          note: 'Mise à jour admin',
        },
      });
    }

    await this.invalidateCache();
    return this.formatProduct(product);
  }

  async remove(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { images: true },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    for (const image of product.images) {
      await this.deleteMediaUrl(image.url);
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.invalidateCache();
    return { message: 'Produit supprimé' };
  }

  private async deleteMediaUrl(url: string): Promise<void> {
    if (!url || url.includes('placehold.co')) return;
    try {
      await this.mediaService.delete(url);
    } catch {
      // Deletion failure must not block entity removal
    }
  }

  private formatProduct(
    product: Prisma.ProductGetPayload<{
      include: {
        category: { select: { id: true; name: true; slug: true } };
        images: true;
      };
    }>,
  ) {
    const serialized = serializeProduct(product);
    return {
      ...serialized,
      images: product.images.map((img) => ({
        ...img,
        url: this.mediaService.resolveUrl(img.url),
      })),
    };
  }

  private async generateReference(name: string): Promise<string> {
    const base = buildProductReferenceBase(name);
    const suffix = Date.now().toString(36).toUpperCase().slice(-6);
    let reference = `${base}-${suffix}`;
    let counter = 0;

    while (await this.prisma.product.findUnique({ where: { reference } })) {
      counter += 1;
      reference = `${base}-${suffix}-${counter}`;
    }

    return reference;
  }

  private async ensureExists(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
  }

  private async invalidateCache() {
    const client = this.redis.getClient();
    const keys = await client.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }
}
