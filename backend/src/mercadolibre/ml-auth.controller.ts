import { Controller, Get, HttpCode, HttpStatus, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MlCallbackQueryDto } from './dto/ml-callback-query.dto';
import { MlAuthService } from './ml-auth.service';

@Controller('ml/auth')
export class MlAuthController {
  constructor(
    private readonly mlAuthService: MlAuthService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('connect')
  connect() {
    return this.mlAuthService.buildAuthorizationUrl();
  }

  @Get('callback')
  async callback(@Query() query: MlCallbackQueryDto, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4300');
    try {
      await this.mlAuthService.handleCallback(query.code, query.state, query.error);
      return res.redirect(`${frontendUrl}/ml-connection?status=success`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      return res.redirect(
        `${frontendUrl}/ml-connection?status=error&message=${encodeURIComponent(message)}`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  status() {
    return this.mlAuthService.getStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect() {
    await this.mlAuthService.disconnect();
  }
}
