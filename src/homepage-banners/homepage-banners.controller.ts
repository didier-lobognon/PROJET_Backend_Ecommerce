import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { HomepageBannersService } from './homepage-banners.service';
import { UpsertHomepageBannerDto } from './dto/upsert-homepage-banner.dto';

@ApiTags('Homepage Banners')
@Controller()
export class HomepageBannersController {
  constructor(private readonly homepageBannersService: HomepageBannersService) {}

  @Get('homepage-banners')
  getPublic() {
    return this.homepageBannersService.getPublic();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/homepage-banners')
  findAll() {
    return this.homepageBannersService.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('admin/homepage-banners')
  upsert(@Body() dto: UpsertHomepageBannerDto) {
    return this.homepageBannersService.upsert(dto);
  }
}
