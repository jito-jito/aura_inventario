import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QueryProcessedOrdersDto } from './dto/query-processed-orders.dto';
import { MlOrdersService } from './ml-orders.service';

@UseGuards(JwtAuthGuard)
@Controller('ml/orders')
export class MlOrdersController {
  constructor(private readonly mlOrdersService: MlOrdersService) {}

  @Get('processed')
  findProcessed(@Query() query: QueryProcessedOrdersDto) {
    return this.mlOrdersService.findProcessed(query);
  }
}
