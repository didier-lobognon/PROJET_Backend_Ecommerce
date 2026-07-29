import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { slugify } from '../common/utils/product.utils';
import { MediaService } from '../media/media.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async findAll(query?: CategoryQueryDto) {
    const where: Prisma.CategoryWhereInput = {};

    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const include = {
      _count: { select: { products: { where: { deletedAt: null } } } },
    } as const;

    if (query?.page) {
      const page = query.page ?? 1;
      const limit = query.limit ?? 10;
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include,
        }),
        this.prisma.category.count({ where }),
      ]);

      return {
        data: items.map((item) => this.formatCategory(item)),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    const items = await this.prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include,
    });

    return items.map((item) => this.formatCategory(item));
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return this.formatCategory(category);
  }

  async create(dto: CreateCategoryDto) {
    const slug = slugify(dto.name);
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        parentId: dto.parentId,
        imageUrl: dto.imageUrl ? this.mediaService.resolveUrl(dto.imageUrl) : null,
      },
    });
    return this.formatCategory(category);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.ensureExists(id);

    const data: Prisma.CategoryUpdateInput = {};

    if (dto.imageUrl !== undefined) {
      const nextUrl = dto.imageUrl ? this.mediaService.resolveUrl(dto.imageUrl) : null;
      if (existing.imageUrl && existing.imageUrl !== nextUrl) {
        await this.deleteMediaUrl(existing.imageUrl);
      }
      data.imageUrl = nextUrl;
    }

    if (dto.name) {
      data.name = dto.name;
      data.slug = slugify(dto.name);
    }

    if (dto.parentId !== undefined) {
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
    }

    const category = await this.prisma.category.update({ where: { id }, data });
    return this.formatCategory(category);
  }

  async remove(id: string) {
    const category = await this.ensureExists(id);
    const productCount = await this.prisma.product.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (productCount > 0) {
      throw new BadRequestException('Impossible de supprimer une catégorie avec des produits');
    }

    if (category.imageUrl) {
      await this.deleteMediaUrl(category.imageUrl);
    }

    await this.prisma.category.delete({ where: { id } });
    return { message: 'Catégorie supprimée' };
  }

  private formatCategory(
    category: Prisma.CategoryGetPayload<{
      include?: { _count: { select: { products: true } } };
    }>,
  ) {
    return {
      ...category,
      imageUrl: category.imageUrl ? this.mediaService.resolveUrl(category.imageUrl) : null,
    };
  }

  private async deleteMediaUrl(url: string): Promise<void> {
    if (!url || url.includes('placehold.co')) return;
    try {
      await this.mediaService.delete(url);
    } catch {
      // Deletion failure must not block entity removal
    }
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }
    return category;
  }
}
