import { ValueTransformer } from 'typeorm';
import { decryptToken, encryptToken } from './token-encryption';

export const encryptedColumnTransformer: ValueTransformer = {
  to: (value: string | null | undefined) => (value ? encryptToken(value) : value),
  from: (value: string | null | undefined) => (value ? decryptToken(value) : value),
};
