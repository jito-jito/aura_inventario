import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertRequiredEnvVars } from './env-validation';

async function bootstrap() {
  assertRequiredEnvVars();

  const app = await NestFactory.create(AppModule);
  app.use(helmet());

  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl
      ? frontendUrl.split(',').map((url) => url.trim())
      : true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error) => {
  Logger.error(
    'Error fatal iniciando la aplicación',
    error instanceof Error ? error.stack : error,
    'Bootstrap',
  );
  process.exit(1);
});
