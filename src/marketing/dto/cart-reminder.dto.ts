import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CampaignChannel } from '@prisma/client';

export class SendCartReminderDto {
  @ApiProperty({ enum: CampaignChannel })
  @IsEnum(CampaignChannel)
  channel!: CampaignChannel;

  @ApiPropertyOptional({ description: 'Objet email (canal EMAIL uniquement)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({
    description:
      'Message personnalisé. Variables : {{fullName}}, {{firstName}}, {{cartItems}}. Gras : **texte**',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
