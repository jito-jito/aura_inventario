import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getDataSourceToken(),
          useValue: { isInitialized: true },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Aura Inventario API"', () => {
      expect(appController.getHello()).toBe('Aura Inventario API');
    });
  });

  describe('health', () => {
    it('should report the database as connected', async () => {
      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'ok',
        database: 'connected',
      });
    });
  });
});
