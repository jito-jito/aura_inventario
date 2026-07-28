export type MlListingSyncStatus = 'pending' | 'synced' | 'error';

export interface MlListingComponent {
  id: string;
  productId: string;
  product: { id: string; sku: string; name: string };
  quantityPerUnit: number;
}

export interface MlListing {
  id: string;
  mlItemId: string;
  mlVariationId: string | null;
  title: string | null;
  components: MlListingComponent[];
  syncStatus: MlListingSyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface CreateMlListingComponentPayload {
  productId: string;
  quantityPerUnit?: number;
}

export interface CreateMlListingPayload {
  mlItemId: string;
  mlVariationId?: string;
  components: CreateMlListingComponentPayload[];
}
