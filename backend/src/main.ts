import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = 'http://localhost:9000';

/** Shared by bootstrap and e2e tests. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const origins = (process.env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN).split(',').map((o) => o.trim());
  app.enableCors({ origin: origins, methods: ['GET'] });
  await app.listen(Number(process.env.PORT) || DEFAULT_PORT);
}

if (require.main === module) {
  void bootstrap();
}
