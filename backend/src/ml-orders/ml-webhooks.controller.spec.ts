import { MlWebhooksController } from './ml-webhooks.controller';

describe('MlWebhooksController', () => {
  let controller: MlWebhooksController;
  let queue: { add: jest.Mock };

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    controller = new MlWebhooksController(queue as any);
  });

  it('encola un job cuando el topic y el resource de orden son válidos', async () => {
    const result = await controller.receive({ topic: 'orders_v2', resource: '/orders/123456789' });

    expect(queue.add).toHaveBeenCalledWith(
      'process-order',
      { orderId: '123456789' },
      expect.objectContaining({ attempts: 3 }),
    );
    expect(result).toEqual({ received: true });
  });

  it('ignora topics que no son de órdenes', async () => {
    const result = await controller.receive({ topic: 'items', resource: '/items/MLA1' });

    expect(queue.add).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });

  it('ignora un resource de orden con formato inesperado', async () => {
    const result = await controller.receive({ topic: 'orders_v2', resource: '/orders/abc' });

    expect(queue.add).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true });
  });
});
