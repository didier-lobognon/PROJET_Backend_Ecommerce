import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeNewsletterDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;
}
