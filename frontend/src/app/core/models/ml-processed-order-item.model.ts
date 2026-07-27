export type MlProcessedOrderItemStatus = 'processed' | 'error';

export interface MlProcessedOrderItem {
  id: string;
  mlOrderId: string;
  mlItemId: string;
  mlVariationId: string | null;
  productId: string;
  product: { id: string; sku: string; name: string };
  quantity: number;
  orderStatus: string;
  status: MlProcessedOrderItemStatus;
  errorMessage: string | null;
  processedAt: string;
}
