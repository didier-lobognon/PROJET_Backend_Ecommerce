import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HomepageBannerButtonStyle,
  HomepageBannerImageSide,
  HomepageBannerSlot,
  HomepageBannerTextAlign,
} from '@prisma/client';

export class UpsertHomepageBannerDto {
  @ApiProperty({ enum: HomepageBannerSlot })
  @IsEnum(HomepageBannerSlot)
  slot: HomepageBannerSlot;

  @ApiPropertyOptional({ example: 'Équipements informatiques' })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiProperty({ example: "JUSQU'À 30% DE RÉDUCTION" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '-20% sur votre 1er projet' })
  @IsOptional()
  @IsString()
  highlightText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ example: '/boutique' })
  @IsString()
  @IsNotEmpty()
  linkUrl: string;

  @ApiProperty({ example: 'Acheter maintenant' })
  @IsString()
  @IsNotEmpty()
  buttonLabel: string;

  @ApiPropertyOptional({ example: '#F5F2EE' })
  @IsOptional()
  @IsString()
  bgColor?: string;

  @ApiPropertyOptional({ example: 350000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceAmount?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  originalPriceAmount?: number;

  @ApiPropertyOptional({ enum: HomepageBannerButtonStyle, default: HomepageBannerButtonStyle.PRIMARY })
  @IsOptional()
  @IsEnum(HomepageBannerButtonStyle)
  buttonStyle?: HomepageBannerButtonStyle;

  @ApiPropertyOptional({ enum: HomepageBannerTextAlign, default: HomepageBannerTextAlign.LEFT })
  @IsOptional()
  @IsEnum(HomepageBannerTextAlign)
  textAlign?: HomepageBannerTextAlign;

  @ApiPropertyOptional({ enum: HomepageBannerImageSide, default: HomepageBannerImageSide.RIGHT })
  @IsOptional()
  @IsEnum(HomepageBannerImageSide)
  imageSide?: HomepageBannerImageSide;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
