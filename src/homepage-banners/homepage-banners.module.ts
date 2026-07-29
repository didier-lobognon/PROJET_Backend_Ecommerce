import { Module } from '@nestjs/common';
import { HomepageBannersController } from './homepage-banners.controller';
import { HomepageBannersService } from './homepage-banners.service';

@Module({
  controllers: [HomepageBannersController],
  providers: [HomepageBannersService],
})
export class HomepageBannersModule {}
