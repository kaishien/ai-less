import { Controller, Get, Inject } from '@nestjs/common';
import { AppService, HelloResponse } from './app.service';

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get('hello')
  getHello(): HelloResponse {
    return this.appService.getHello();
  }
}
