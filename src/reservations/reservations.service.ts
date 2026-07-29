import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MediaService } from '../media/media.service';
import {
  CreateReservationDto,
  ReservationQueryDto,
  UpdateReservationStatusDto,
} from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mediaService: MediaService,
  ) {}

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const url = await this.mediaService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'reservations',
    );
    return { url };
  }

  async create(dto: CreateReservationDto, userId?: string) {
    const reservation = await this.prisma.productReservation.create({
      data: {
        userId: userId ?? null,
        productName: dto.productName.trim(),
        searchQuery: dto.searchQuery?.trim() || null,
        description: dto.description?.trim() || null,
        estimatedBudget: dto.estimatedBudget ?? null,
        imageUrl: dto.imageUrl?.trim() || null,
        fullName: dto.fullName.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
      },
    });

    await this.notifications.notifyReservationReceived(reservation);
    return this.formatReservation(reservation);
  }

  async findMine(userId: string, query: ReservationQueryDto) {
    return this.findMany({ ...query, userId });
  }

  async findAllAdmin(query: ReservationQueryDto) {
    return this.findMany(query);
  }

  async updateStatus(id: string, dto: UpdateReservationStatusDto) {
    const existing = await this.prisma.productReservation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Réservation introuvable');
    }

    const previousStatus = existing.status;
    const reservation = await this.prisma.productReservation.update({
      where: { id },
      data: {
        status: dto.status as ReservationStatus,
        adminNote: dto.adminNote?.trim() ?? existing.adminNote,
        offeredDiscount: dto.offeredDiscount ?? existing.offeredDiscount,
      },
    });

    if (previousStatus !== reservation.status) {
      await this.notifications.notifyReservationStatusChange(reservation);
    }

    return this.formatReservation(reservation);
  }

  private async findMany(query: ReservationQueryDto & { userId?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductReservationWhereInput = {
      ...(query.status ? { status: query.status as ReservationStatus } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.productReservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.productReservation.count({ where }),
    ]);

    return {
      data: items.map((item) => this.formatReservation(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private formatReservation(
    reservation: Prisma.ProductReservationGetPayload<object>,
  ) {
    return {
      ...reservation,
      estimatedBudget: reservation.estimatedBudget?.toNumber() ?? null,
    };
  }
}
