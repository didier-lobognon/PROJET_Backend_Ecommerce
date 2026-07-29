import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/create-promotion.dto';

const promotionInclude = {
  product: { include: { images: { take: 1, orderBy: { order: 'asc' as const } } } },
};

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive() {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startAt: { lte: now },
        endAt: { gt: now },
      },
      include: promotionInclude,
      orderBy: { endAt: 'asc' },
    });
  }

  async getHomepage() {
    const now = new Date();
    return this.prisma.promotion.findFirst({
      where: {
        showOnHomepage: true,
        isActive: true,
        startAt: { lte: now },
        endAt: { gt: now },
      },
      include: promotionInclude,
      orderBy: { endAt: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.promotion.findMany({
      include: promotionInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreatePromotionDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.showOnHomepage) {
        await this.clearHomepageFlag(tx);
      }

      const promotion = await tx.promotion.create({
        data: {
          title: dto.title,
          tagline: dto.tagline,
          description: dto.description,
          imageUrl: dto.imageUrl,
          productId: dto.productId,
          discount: dto.discount,
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
          isActive: dto.isActive ?? true,
          showOnHomepage: dto.showOnHomepage ?? false,
        },
        include: promotionInclude,
      });

      if (dto.productId) {
        await this.syncProductDiscount(tx, dto.productId, dto.discount);
      }

      return promotion;
    });
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion introuvable');

    return this.prisma.$transaction(async (tx) => {
      if (dto.showOnHomepage) {
        await this.clearHomepageFlag(tx, id);
      }

      const promotion = await tx.promotion.update({
        where: { id },
        data: {
          ...dto,
          startAt: dto.startAt ? new Date(dto.startAt) : undefined,
          endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        },
        include: promotionInclude,
      });

      const productId = dto.productId ?? promo.productId;
      const discount = dto.discount ?? promo.discount;

      if (productId && (dto.productId || dto.discount !== undefined)) {
        await this.syncProductDiscount(tx, productId, discount);
      }

      if (dto.productId && promo.productId && dto.productId !== promo.productId) {
        await this.clearProductDiscount(tx, promo.productId);
      }

      return promotion;
    });
  }

  async delete(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion introuvable');

    await this.prisma.$transaction(async (tx) => {
      if (promo.productId) {
        await this.clearProductDiscount(tx, promo.productId);
      }
      await tx.promotion.delete({ where: { id } });
    });
  }

  private async clearHomepageFlag(tx: Prisma.TransactionClient, exceptId?: string) {
    await tx.promotion.updateMany({
      where: {
        showOnHomepage: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { showOnHomepage: false },
    });
  }

  private async syncProductDiscount(
    tx: Prisma.TransactionClient,
    productId: string,
    discount: number,
  ) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const price = Number(product.price);
    const discountPrice = Math.round(price * (1 - discount / 100));

    await tx.product.update({
      where: { id: productId },
      data: { discountPrice },
    });
  }

  private async clearProductDiscount(tx: Prisma.TransactionClient, productId: string) {
    await tx.product.update({
      where: { id: productId },
      data: { discountPrice: null },
    });
  }
}
