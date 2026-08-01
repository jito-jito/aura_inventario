import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource usado solo por el CLI de TypeORM (generar/correr migraciones).
 * La app en tiempo de ejecución usa TypeOrmModule.forRootAsync en app.module.ts;
 * este archivo se mantiene alineado a mano con esa config (mismas entidades/env).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'aura',
  password: process.env.DB_PASSWORD ?? 'aura',
  database: process.env.DB_NAME ?? 'aura_inventario',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
