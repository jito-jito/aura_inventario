export type IntegrationErrorType = 'ml_connection' | 'ml_listing' | 'order_processing';

export interface IntegrationErrorItem {
  type: IntegrationErrorType;
  message: string;
  context: string;
  occurredAt: string;
}
