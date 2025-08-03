import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PORT } from './util/constants';
import { XMLFetcherService } from './services/xml-fetcher.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(PORT);
  console.log(`Nest.js API listening on PORT: ${PORT}`);
  // Manually run XML fetch once at startup (non-blocking)
  const xmlFetcher = app.get(XMLFetcherService);
  xmlFetcher.runOnce();
}

bootstrap();
