import { Controller, Get, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ImagesService } from './images.service';
import { GenerateDto } from './dto/generate.dto';

@Controller('api/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateDto) {
    if (!dto?.prompt?.trim()) {
      throw new HttpException('Prompt is required', HttpStatus.BAD_REQUEST);
    }
    return this.imagesService.generate(dto.prompt.trim());
  }

  @Get()
  findAll() {
    return this.imagesService.findAll();
  }
}
