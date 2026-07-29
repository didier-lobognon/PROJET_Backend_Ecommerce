import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ example: 'KN-20260703-0001' })
  @IsString()
  orderNumber!: string;

  @ApiPropertyOptional({ description: 'Email requis pour les commandes invité' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class PaymentStatusQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}
