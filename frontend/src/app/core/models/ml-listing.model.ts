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
  variationLabel: string | null;
  title: string | null;
  thumbnail: string | null;
  price: number | null;
  components: MlListingComponent[];
  syncStatus: MlListingSyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface MlSearchItemVariation {
  id: string;
  label: string;
  alreadyLinked: boolean;
}

export interface MlSearchItem {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number | null;
  availableQuantity: number | null;
  variations: MlSearchItemVariation[];
  alreadyLinked: boolean;
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
