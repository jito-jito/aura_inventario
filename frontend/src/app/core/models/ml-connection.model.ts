export interface MlConnectionStatus {
  connected: boolean;
  mlUserId?: string;
  nickname?: string;
  expiresAt?: string;
  lastError?: string;
}
