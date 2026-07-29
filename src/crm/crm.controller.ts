import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InteractionChannel, UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CrmService } from './crm.service';
import { CreateFaqScenarioDto, UpdateFaqScenarioDto } from './dto/faq.dto';
import {
  AssignSegmentsDto,
  CreateSegmentDto,
  SegmentMembersDto,
  UpdateSegmentDto,
} from './dto/segment.dto';
import { CreateCustomerTagDto } from './dto/tag.dto';

@ApiTags('admin-crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('tags')
  @ApiOperation({ summary: 'Liste des tags (étiquettes de segments)' })
  listTags() {
    return this.crmService.listTags();
  }

  @Post('tags')
  createTag(@Body() dto: CreateCustomerTagDto) {
    return this.crmService.createTag(dto);
  }

  @Delete('tags/:id')
  deleteTag(@Param('id') id: string) {
    return this.crmService.deleteTag(id);
  }

  @Get('segments')
  listSegments() {
    return this.crmService.listSegments();
  }

  @Post('segments')
  createSegment(@Body() dto: CreateSegmentDto) {
    return this.crmService.createSegment(dto);
  }

  @Patch('segments/:id')
  updateSegment(@Param('id') id: string, @Body() dto: UpdateSegmentDto) {
    return this.crmService.updateSegment(id, dto);
  }

  @Delete('segments/:id')
  deleteSegment(@Param('id') id: string) {
    return this.crmService.deleteSegment(id);
  }

  @Get('segments/:id/preview')
  previewSegment(@Param('id') id: string) {
    return this.crmService.previewSegment(id);
  }

  @Get('segments/:id/members')
  @ApiOperation({ summary: 'Clients assignés à un groupe' })
  getSegmentMembers(@Param('id') id: string) {
    return this.crmService.getSegmentMembers(id);
  }

  @Post('segments/:id/members')
  @ApiOperation({ summary: 'Ajouter des clients à un groupe' })
  addSegmentMembers(@Param('id') id: string, @Body() dto: SegmentMembersDto) {
    return this.crmService.addSegmentMembers(id, dto.userIds);
  }

  @Delete('segments/:id/members/:userId')
  @ApiOperation({ summary: 'Retirer un client d\'un groupe' })
  removeSegmentMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.crmService.removeSegmentMember(id, userId);
  }

  @Get('customers/:userId/segments')
  @ApiOperation({ summary: 'Segments assignés à un client' })
  getUserSegments(@Param('userId') userId: string) {
    return this.crmService.getUserSegments(userId);
  }

  @Post('customers/:userId/segments')
  @ApiOperation({ summary: 'Assigner un client à des segments' })
  assignSegments(@Param('userId') userId: string, @Body() dto: AssignSegmentsDto) {
    return this.crmService.assignSegmentsToUser(userId, dto.segmentIds);
  }

  @Get('interactions')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'channel', required: false })
  listInteractions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('channel') channel?: InteractionChannel,
  ) {
    return this.crmService.listInteractions({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      userId,
      channel,
    });
  }

  @Get('customers/:userId/interactions')
  userTimeline(@Param('userId') userId: string) {
    return this.crmService.getUserInteractionTimeline(userId);
  }

  @Get('faq')
  listFaq() {
    return this.crmService.listFaqScenarios();
  }

  @Post('faq')
  createFaq(@Body() dto: CreateFaqScenarioDto) {
    return this.crmService.createFaqScenario(dto);
  }

  @Patch('faq/:id')
  updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqScenarioDto) {
    return this.crmService.updateFaqScenario(id, dto);
  }

  @Delete('faq/:id')
  deleteFaq(@Param('id') id: string) {
    return this.crmService.deleteFaqScenario(id);
  }
}
