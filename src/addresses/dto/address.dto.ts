import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Domicile' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'Kouassi Jean' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '+225 07 00 00 00 00' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Riviera 2, Rue des Jardins' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Abidjan' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'Cocody' })
  @IsOptional()
  @IsString()
  commune?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  commune?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
