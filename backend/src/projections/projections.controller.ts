import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProjectionScenarioDto } from './dto/create-projection-scenario.dto';
import { SuggestedUnitsQueryDto } from './dto/suggested-units-query.dto';
import { UpdateProjectionScenarioDto } from './dto/update-projection-scenario.dto';
import { ProjectionsService } from './projections.service';

@UseGuards(JwtAuthGuard)
@Controller('projections')
export class ProjectionsController {
  constructor(private readonly projectionsService: ProjectionsService) {}

  @Get('suggested-units')
  getSuggestedUnits(@Query() query: SuggestedUnitsQueryDto) {
    return this.projectionsService.getSuggestedUnitsPerPeriod(query.productId, query.periodType);
  }

  @Post()
  create(@Body() dto: CreateProjectionScenarioDto) {
    return this.projectionsService.create(dto);
  }

  @Get()
  findAll() {
    return this.projectionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectionScenarioDto) {
    return this.projectionsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectionsService.remove(id);
  }
}
