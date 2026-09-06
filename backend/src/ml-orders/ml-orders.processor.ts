import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MlOrdersService } from './ml-orders.service';

@Processor('ml-orders')
export class MlOrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(MlOrdersProcessor.name);

  constructor(private readonly mlOrdersService: MlOrdersService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    this.logger.log(`Procesando orden ${job.data.orderId} (intento ${job.attemptsMade + 1})`);
    await this.mlOrdersService.processOrder(job.data.orderId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<{ orderId: string }> | undefined, error: Error): void {
    this.logger.error(
      `Falló el procesamiento de la orden ${job?.data.orderId} (intento ${job ? job.attemptsMade : '?'}): ${error.message}`,
      error.stack,
    );
  }
}
