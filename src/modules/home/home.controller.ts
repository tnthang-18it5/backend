import { Controller, Get, Query } from '@nestjs/common';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  getInformationHomePage() {
    return this.homeService.getInformationHomePage();
  }

  @Get('search')
  search(@Query() query: { keyword: string }) {
    return this.homeService.search(query.keyword);
  }

  @Get('system-info')
  getSystemInfo() {
    return this.homeService.getSystemInfo();
  }
}
