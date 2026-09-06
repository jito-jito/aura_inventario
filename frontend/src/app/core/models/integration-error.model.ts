export type IntegrationErrorType = 'ml_connection' | 'ml_listing' | 'order_processing' | 'order_fetch';

export interface IntegrationErrorItem {
  type: IntegrationErrorType;
  message: string;
  context: string;
  occurredAt: string;
}
