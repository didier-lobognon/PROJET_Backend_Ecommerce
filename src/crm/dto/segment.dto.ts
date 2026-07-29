import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SegmentRules } from '../crm.types';

export class CreateSegmentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tag associé au segment (étiquette visuelle)' })
  @IsOptional()
  @IsUUID('4')
  tagId?: string;

  @ApiPropertyOptional({ example: { minOrderCount: 1 } })
  @IsOptional()
  @IsObject()
  rules?: SegmentRules;
}

export class UpdateSegmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  tagId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  rules?: SegmentRules;
}

export class AssignSegmentsDto {
  @ApiProperty({ type: [String], description: 'IDs des segments assignés au client' })
  @IsArray()
  @IsUUID('4', { each: true })
  segmentIds!: string[];
}

export class SegmentMembersDto {
  @ApiProperty({ type: [String], description: 'IDs des clients à ajouter au groupe' })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds!: string[];
}
