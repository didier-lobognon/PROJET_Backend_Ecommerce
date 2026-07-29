import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InteractionChannel,
  InteractionDirection,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LogInteractionInput } from './crm.types';
import { CreateFaqScenarioDto, UpdateFaqScenarioDto } from './dto/faq.dto';
import {
  CreateSegmentDto,
  UpdateSegmentDto,
} from './dto/segment.dto';
import { CreateCustomerTagDto } from './dto/tag.dto';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async logInteraction(input: LogInteractionInput) {
    return this.prisma.customerInteraction.create({
      data: {
        userId: input.userId ?? undefined,
        phone: input.phone ?? undefined,
        email: input.email ?? undefined,
        channel: input.channel as InteractionChannel,
        direction: input.direction as InteractionDirection,
        type: input.type,
        subject: input.subject,
        body: input.body,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        orderId: input.orderId,
        campaignId: input.campaignId,
      },
    });
  }

  // ─── Tags ───────────────────────────────────────────────────────────────────

  async listTags() {
    const tags = await this.prisma.customerTag.findMany({
      orderBy: { name: 'asc' },
      include: {
        segments: {
          include: {
            _count: { select: { users: true } },
          },
        },
      },
    });

    return tags.map(({ segments, ...tag }) => ({
      ...tag,
      segmentCount: segments.length,
      userCount: segments.reduce((sum, segment) => sum + segment._count.users, 0),
    }));
  }

  async createTag(dto: CreateCustomerTagDto) {
    const slug = slugify(dto.name);
    const existing = await this.prisma.customerTag.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });
    if (existing) throw new ConflictException('Ce tag existe déjà');

    return this.prisma.customerTag.create({
      data: {
        name: dto.name.trim(),
        slug,
        color: dto.color ?? '#E8920A',
        description: dto.description,
      },
    });
  }

  async deleteTag(id: string) {
    await this.findTagOrThrow(id);
    await this.prisma.customerTag.delete({ where: { id } });
    return { message: 'Tag supprimé' };
  }

  // ─── Segments ───────────────────────────────────────────────────────────────

  async listSegments() {
    const segments = await this.prisma.customerSegment.findMany({
      orderBy: { name: 'asc' },
      include: {
        tag: true,
        _count: { select: { users: true, campaigns: true } },
      },
    });

    return segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      slug: segment.slug,
      description: segment.description,
      tagId: segment.tagId,
      tag: segment.tag,
      rules: segment.rules as Record<string, unknown>,
      userCount: segment._count.users,
      campaignCount: segment._count.campaigns,
    }));
  }

  async createSegment(dto: CreateSegmentDto) {
    const slug = slugify(dto.name);
    if (dto.tagId) await this.findTagOrThrow(dto.tagId);

    return this.prisma.customerSegment.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        tagId: dto.tagId,
        rules: (dto.rules ?? {}) as Prisma.InputJsonValue,
      },
      include: { tag: true },
    });
  }

  async updateSegment(id: string, dto: UpdateSegmentDto) {
    await this.findSegmentOrThrow(id);
    if (dto.tagId) await this.findTagOrThrow(dto.tagId);

    return this.prisma.customerSegment.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        tagId: dto.tagId === null ? null : dto.tagId,
        rules: dto.rules as Prisma.InputJsonValue | undefined,
      },
      include: { tag: true },
    });
  }

  async deleteSegment(id: string) {
    await this.findSegmentOrThrow(id);
    await this.prisma.customerSegment.delete({ where: { id } });
    return { message: 'Segment supprimé' };
  }

  async previewSegment(id: string, limit = 20) {
    const users = await this.resolveSegmentUsers(id);
    return {
      total: users.length,
      preview: users.slice(0, limit).map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
      })),
    };
  }

  async resolveSegmentUsers(segmentId: string) {
    await this.findSegmentOrThrow(segmentId);

    const memberships = await this.prisma.userCustomerSegment.findMany({
      where: {
        segmentId,
        user: { role: UserRole.CLIENT, isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            emailMarketingConsent: true,
            whatsappMarketingConsent: true,
          },
        },
      },
    });

    return memberships.map((row) => row.user);
  }

  async countSegmentUsers(segmentId: string) {
    return this.prisma.userCustomerSegment.count({
      where: {
        segmentId,
        user: { role: UserRole.CLIENT, isActive: true },
      },
    });
  }

  async getSegmentMembers(segmentId: string) {
    const users = await this.resolveSegmentUsers(segmentId);
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: true,
    }));
  }

  async addSegmentMembers(segmentId: string, userIds: string[]) {
    await this.findSegmentOrThrow(segmentId);

    for (const userId of userIds) {
      await this.findClientOrThrow(userId);
    }

    if (userIds.length > 0) {
      await this.prisma.userCustomerSegment.createMany({
        data: userIds.map((userId) => ({ userId, segmentId })),
        skipDuplicates: true,
      });
    }

    return this.getSegmentMembers(segmentId);
  }

  async removeSegmentMember(segmentId: string, userId: string) {
    await this.findSegmentOrThrow(segmentId);
    await this.findClientOrThrow(userId);

    await this.prisma.userCustomerSegment.deleteMany({
      where: { segmentId, userId },
    });

    return { message: 'Client retiré du groupe' };
  }

  async assignSegmentsToUser(userId: string, segmentIds: string[]) {
    await this.findClientOrThrow(userId);

    if (segmentIds.length > 0) {
      const found = await this.prisma.customerSegment.count({
        where: { id: { in: segmentIds } },
      });
      if (found !== segmentIds.length) {
        throw new NotFoundException('Un ou plusieurs segments sont introuvables');
      }
    }

    await this.prisma.userCustomerSegment.deleteMany({ where: { userId } });
    if (segmentIds.length > 0) {
      await this.prisma.userCustomerSegment.createMany({
        data: segmentIds.map((segmentId) => ({ userId, segmentId })),
        skipDuplicates: true,
      });
    }

    return this.getUserSegments(userId);
  }

  async getUserSegments(userId: string) {
    await this.findClientOrThrow(userId);

    const rows = await this.prisma.userCustomerSegment.findMany({
      where: { userId },
      include: { segment: { include: { tag: true } } },
      orderBy: { segment: { name: 'asc' } },
    });

    return rows.map((row) => ({
      id: row.segment.id,
      name: row.segment.name,
      slug: row.segment.slug,
      description: row.segment.description,
      tagId: row.segment.tagId,
      tag: row.segment.tag,
      assignedAt: row.assignedAt,
    }));
  }

  // ─── Interactions ───────────────────────────────────────────────────────────

  async listInteractions(params: {
    page: number;
    limit: number;
    userId?: string;
    channel?: InteractionChannel;
  }) {
    const { page, limit, userId, channel } = params;
    const skip = (page - 1) * limit;
    const where = {
      ...(userId ? { userId } : {}),
      ...(channel ? { channel } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.customerInteraction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.customerInteraction.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserInteractionTimeline(userId: string, limit = 50) {
    return this.prisma.customerInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── FAQ ────────────────────────────────────────────────────────────────────

  async listFaqScenarios() {
    return this.prisma.faqScenario.findMany({
      orderBy: [{ priority: 'desc' }, { title: 'asc' }],
    });
  }

  async createFaqScenario(dto: CreateFaqScenarioDto) {
    return this.prisma.faqScenario.create({
      data: {
        title: dto.title.trim(),
        keywords: dto.keywords.map((k) => k.toLowerCase().trim()),
        responseText: dto.responseText.trim(),
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 0,
      },
    });
  }

  async updateFaqScenario(id: string, dto: UpdateFaqScenarioDto) {
    await this.findFaqOrThrow(id);
    return this.prisma.faqScenario.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        keywords: dto.keywords?.map((k) => k.toLowerCase().trim()),
        responseText: dto.responseText?.trim(),
        isActive: dto.isActive,
        priority: dto.priority,
      },
    });
  }

  async deleteFaqScenario(id: string) {
    await this.findFaqOrThrow(id);
    await this.prisma.faqScenario.delete({ where: { id } });
    return { message: 'Scénario FAQ supprimé' };
  }

  async matchFaqMessage(message: string) {
    const normalized = message.toLowerCase().trim();
    const scenarios = await this.prisma.faqScenario.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'desc' }, { title: 'asc' }],
    });

    for (const scenario of scenarios) {
      if (scenario.keywords.some((keyword) => normalized.includes(keyword))) {
        return scenario;
      }
    }
    return null;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async findTagOrThrow(id: string) {
    const tag = await this.prisma.customerTag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag introuvable');
    return tag;
  }

  private async findSegmentOrThrow(id: string) {
    const segment = await this.prisma.customerSegment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundException('Segment introuvable');
    return segment;
  }

  private async findFaqOrThrow(id: string) {
    const faq = await this.prisma.faqScenario.findUnique({ where: { id } });
    if (!faq) throw new NotFoundException('Scénario FAQ introuvable');
    return faq;
  }

  private async findClientOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.CLIENT) {
      throw new NotFoundException('Client introuvable');
    }
    return user;
  }
}
