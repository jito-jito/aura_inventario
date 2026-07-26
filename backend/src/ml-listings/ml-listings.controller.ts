import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMlListingDto } from './dto/create-ml-listing.dto';
import { MlListingsService } from './ml-listings.service';

@UseGuards(JwtAuthGuard)
@Controller('ml/listings')
export class MlListingsController {
  constructor(private readonly mlListingsService: MlListingsService) {}

  @Post()
  create(@Body() dto: CreateMlListingDto) {
    return this.mlListingsService.create(dto);
  }

  @Get()
  findAll() {
    return this.mlListingsService.findAll();
  }

  @Get('unlinked-products')
  findUnlinkedProducts() {
    return this.mlListingsService.findUnlinkedProducts();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mlListingsService.remove(id);
  }
}
