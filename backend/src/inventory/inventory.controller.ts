import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMovementDto } from './dto/create-movement.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('movements')
  registerMovement(@Body() dto: CreateMovementDto) {
    return this.inventoryService.registerMovement(dto);
  }

  @Get('movements')
  findMovements(@Query('productId') productId?: string) {
    if (productId) {
      return this.inventoryService.findByProduct(productId);
    }
    return this.inventoryService.findAll();
  }
}
