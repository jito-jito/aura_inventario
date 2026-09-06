import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QueryProductsDto } from '../products/dto/query-products.dto';
import { CreateMlListingDto } from './dto/create-ml-listing.dto';
import { UpdateMlListingComponentsDto } from './dto/update-ml-listing-components.dto';
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
  findUnlinkedProducts(@Query() query: QueryProductsDto) {
    return this.mlListingsService.findUnlinkedProducts(query);
  }

  @Get('search-ml')
  searchMyListings() {
    return this.mlListingsService.searchMyListings();
  }

  @Patch(':id')
  updateComponents(@Param('id') id: string, @Body() dto: UpdateMlListingComponentsDto) {
    return this.mlListingsService.updateComponents(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mlListingsService.remove(id);
  }
}
