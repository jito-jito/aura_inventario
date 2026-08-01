const REQUIRED_IN_PRODUCTION = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD_HASH',
  'JWT_SECRET',
  'ML_TOKEN_ENCRYPTION_KEY',
  'FRONTEND_URL',
  'REDIS_HOST',
  'REDIS_PORT',
];

const INSECURE_DEFAULTS: Record<string, string> = {
  JWT_SECRET: 'change-me-in-production',
  ML_TOKEN_ENCRYPTION_KEY: 'change-me-in-production',
};

/**
 * Falla rápido en producción si falta una variable de entorno requerida o si
 * quedó el valor de ejemplo de .env.example (que dejaría tokens/JWT
 * firmados con un secreto público y conocido).
 */
export function assertRequiredEnvVars(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas en producción: ${missing.join(', ')}. Revisar backend/.env.example.`,
    );
  }

  const insecure = Object.entries(INSECURE_DEFAULTS).filter(
    ([key, defaultValue]) => process.env[key] === defaultValue,
  );
  if (insecure.length > 0) {
    throw new Error(
      `Estas variables de entorno tienen el valor de ejemplo de .env.example y deben cambiarse en producción: ${insecure
        .map(([key]) => key)
        .join(', ')}.`,
    );
  }
}
