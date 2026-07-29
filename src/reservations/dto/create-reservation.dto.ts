import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: 'MacBook Pro M3 14"' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productName!: string;

  @ApiPropertyOptional({ description: 'Terme de recherche utilisé dans la boutique' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  searchQuery?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 850000, description: 'Budget estimé en FCFA' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedBudget?: number;

  @ApiPropertyOptional({ description: 'URL de l\'image de référence (upload préalable)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiProperty({ example: 'Kouamé Yao' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '0700000000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'DELIVERED'] })
  @IsString()
  @IsNotEmpty()
  status!: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;

  @ApiPropertyOptional({ description: 'Réduction proposée en %' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  offeredDiscount?: number;
}

export class ReservationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'DELIVERED'] })
  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED';
}
