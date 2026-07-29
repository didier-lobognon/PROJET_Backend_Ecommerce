import { IsString, IsOptional, IsInt, IsDateString, IsBoolean, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePromotionDto {
  @ApiProperty({ example: 'Promo rentrée' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Ne manquez pas !!' })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  discount: number;

  @ApiProperty({ example: '2026-07-01T00:00:00Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: '2026-07-31T23:59:59Z' })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Afficher dans la bannière countdown de l\'accueil' })
  @IsOptional()
  @IsBoolean()
  showOnHomepage?: boolean;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  discount?: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnHomepage?: boolean;
}
