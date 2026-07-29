import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@ApiTags('admin-campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  list() {
    return this.campaignsService.listCampaigns();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.campaignsService.getCampaign(id);
  }

  @Post()
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: JwtPayload) {
    return this.campaignsService.createCampaign(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.updateCampaign(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaignsService.deleteCampaign(id);
  }

  @Post(':id/launch')
  @ApiOperation({ summary: 'Lancer une campagne (respect consentement RGPD)' })
  launch(@Param('id') id: string) {
    return this.campaignsService.launchCampaign(id);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Renvoyer une campagne aux membres actuels du groupe' })
  resend(@Param('id') id: string) {
    return this.campaignsService.resendCampaign(id);
  }
}
