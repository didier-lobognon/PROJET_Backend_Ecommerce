import { Injectable } from '@nestjs/common';
import { HomepageBannerSlot } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertHomepageBannerDto } from './dto/upsert-homepage-banner.dto';

@Injectable()
export class HomepageBannersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic() {
    return this.prisma.homepageBanner.findMany({
      where: { isActive: true },
      orderBy: { slot: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.homepageBanner.findMany({
      orderBy: { slot: 'asc' },
    });
  }

  async upsert(dto: UpsertHomepageBannerDto) {
    const data = {
      tagline: dto.tagline,
      title: dto.title,
      description: dto.description,
      highlightText: dto.highlightText,
      imageUrl: dto.imageUrl,
      linkUrl: dto.linkUrl,
      buttonLabel: dto.buttonLabel,
      bgColor: dto.bgColor,
      priceAmount: dto.priceAmount,
      originalPriceAmount: dto.originalPriceAmount,
      buttonStyle: dto.buttonStyle,
      textAlign: dto.textAlign,
      imageSide: dto.imageSide,
      isActive: dto.isActive ?? true,
    };

    return this.prisma.homepageBanner.upsert({
      where: { slot: dto.slot },
      create: { slot: dto.slot, ...data },
      update: data,
    });
  }

  async ensureDefaults() {
    const defaults: UpsertHomepageBannerDto[] = [
      {
        slot: HomepageBannerSlot.MAIN,
        tagline: 'Équipements informatiques',
        title: "JUSQU'À 30% DE RÉDUCTION",
        description:
          "Découvrez notre sélection d'ordinateurs portables, desktops et accessoires aux meilleurs prix d'Abidjan.",
        imageUrl: '/images/promo/promo-01.png',
        linkUrl: '/boutique',
        buttonLabel: 'Acheter maintenant',
        bgColor: '#F5F2EE',
        buttonStyle: 'PRIMARY' as const,
        textAlign: 'LEFT' as const,
        imageSide: 'RIGHT' as const,
        isActive: true,
      },
      {
        slot: HomepageBannerSlot.GRID_LEFT,
        tagline: 'Services audiovisuels',
        title: 'Solutions sur mesure personnalisées',
        highlightText: '-20% sur votre 1er projet',
        imageUrl: '/images/promo/promo-02.png',
        linkUrl: '/services',
        buttonLabel: 'Découvrir',
        bgColor: '#FDF5E6',
        buttonStyle: 'TEAL' as const,
        textAlign: 'RIGHT' as const,
        imageSide: 'LEFT' as const,
        isActive: true,
      },
      {
        slot: HomepageBannerSlot.GRID_RIGHT,
        tagline: 'Académie Kaniê',
        title: "Jusqu'à 40% de réduction",
        description:
          'Formations en marketing digital, montage vidéo, infographie et plus encore.',
        imageUrl: '/images/promo/promo-03.png',
        linkUrl: '/academie',
        buttonLabel: "S'inscrire",
        bgColor: '#FAEACA',
        buttonStyle: 'ORANGE' as const,
        textAlign: 'LEFT' as const,
        imageSide: 'RIGHT' as const,
        isActive: true,
      },
      {
        slot: HomepageBannerSlot.HERO_CARD_TOP,
        tagline: 'Offre limitée',
        title: 'Ordinateurs portables & desktops',
        imageUrl: '/images/hero/hero-02.png',
        linkUrl: '/boutique',
        buttonLabel: 'Voir',
        bgColor: '#E8F4FD',
        priceAmount: 350000,
        originalPriceAmount: 500000,
        buttonStyle: 'PRIMARY' as const,
        textAlign: 'LEFT' as const,
        imageSide: 'RIGHT' as const,
        isActive: true,
      },
      {
        slot: HomepageBannerSlot.HERO_CARD_BOTTOM,
        tagline: 'Offre limitée',
        title: 'Accessoires & périphériques',
        imageUrl: '/images/hero/hero-01.png',
        linkUrl: '/boutique',
        buttonLabel: 'Voir',
        bgColor: '#E6F9F1',
        priceAmount: 25000,
        originalPriceAmount: 45000,
        buttonStyle: 'PRIMARY' as const,
        textAlign: 'LEFT' as const,
        imageSide: 'RIGHT' as const,
        isActive: true,
      },
    ];

    for (const banner of defaults) {
      const existing = await this.prisma.homepageBanner.findUnique({
        where: { slot: banner.slot },
      });
      if (!existing) {
        await this.upsert(banner);
      }
    }
  }
}
