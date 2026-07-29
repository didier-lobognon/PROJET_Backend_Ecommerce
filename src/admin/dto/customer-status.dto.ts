import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CustomerStatusDto {
  @ApiProperty({ example: false, description: 'false = suspendu, true = actif' })
  @IsBoolean()
  isActive!: boolean;
}
