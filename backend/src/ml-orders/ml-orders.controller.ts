import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MlOrdersService } from './ml-orders.service';

@UseGuards(JwtAuthGuard)
@Controller('ml/orders')
export class MlOrdersController {
  constructor(private readonly mlOrdersService: MlOrdersService) {}

  @Get('processed')
  findRecentlyProcessed() {
    return this.mlOrdersService.findRecentlyProcessed();
  }
}
