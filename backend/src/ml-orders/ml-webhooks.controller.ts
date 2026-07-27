import { InjectQueue } from '@nestjs/bullmq';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MlWebhookNotificationDto } from './dto/ml-webhook-notification.dto';

const SUPPORTED_TOPICS = ['orders_v2', 'orders'];
const ORDER_RESOURCE_PATTERN = /^\/orders\/(\d+)$/;

/**
 * Endpoint público al que Mercado Libre llama cuando cambia una orden. No lleva
 * JwtAuthGuard porque lo invoca Mercado Libre directamente, no un usuario logueado.
 * Solo se usa el `resource` de la notificación para saber qué orden re-consultar;
 * los datos de la orden siempre se vuelven a pedir a la API con nuestro propio
 * access token, nunca se confía en contenido del payload entrante.
 */
@Controller('ml/webhooks')
export class MlWebhooksController {
  constructor(@InjectQueue('ml-orders') private readonly ordersQueue: Queue) {}

  @Post('orders')
  @HttpCode(HttpStatus.OK)
  async receive(@Body() dto: MlWebhookNotificationDto) {
    if (!SUPPORTED_TOPICS.includes(dto.topic)) {
      return { received: true };
    }

    const match = ORDER_RESOURCE_PATTERN.exec(dto.resource);
    if (!match) {
      return { received: true };
    }

    const orderId = match[1];
    await this.ordersQueue.add(
      'process-order',
      { orderId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );

    return { received: true };
  }
}
