import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { MobileMoneyMethod } from '../paydunya/payment-methods';

export class ProcessPaymentDto {
  @ApiProperty({ example: 'KN-20260703-0001' })
  @IsString()
  orderNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: MobileMoneyMethod })
  @IsEnum(MobileMoneyMethod)
  method!: MobileMoneyMethod;

  @ApiProperty({ example: 'Jean Kouassi' })
  @IsString()
  fullName!: string;

  @ApiProperty({ example: '07 07 12 34 56' })
  @IsString()
  @Matches(/^[\d\s+()-]{8,15}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;

  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  customerEmail!: string;

  @ApiPropertyOptional({ description: 'Code OTP Orange Money (obligatoire pour Orange)' })
  @ValidateIf((dto: ProcessPaymentDto) => dto.method === MobileMoneyMethod.ORANGE)
  @IsString()
  otp?: string;
}
