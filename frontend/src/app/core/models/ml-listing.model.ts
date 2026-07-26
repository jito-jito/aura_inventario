export type MlListingSyncStatus = 'pending' | 'synced' | 'error';

export interface MlListing {
  id: string;
  productId: string;
  product: { id: string; sku: string; name: string };
  mlItemId: string;
  mlVariationId: string | null;
  title: string | null;
  syncStatus: MlListingSyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface CreateMlListingPayload {
  productId: string;
  mlItemId: string;
  mlVariationId?: string;
}
