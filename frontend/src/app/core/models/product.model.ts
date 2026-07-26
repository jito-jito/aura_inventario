export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  cost: string;
  stock: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductPayload {
  sku: string;
  name: string;
  description?: string;
  cost: number;
  stock?: number;
  minStock?: number;
}

export type UpdateProductPayload = Partial<
  Pick<CreateProductPayload, 'sku' | 'name' | 'description' | 'cost' | 'minStock'>
>;
