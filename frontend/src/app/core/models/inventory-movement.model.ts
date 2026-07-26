export type MovementType = 'in' | 'out' | 'adjustment';

export interface InventoryMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
}

export interface CreateMovementPayload {
  productId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
  reference?: string;
}
