import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PORT } from './util/constants';
import { XMLFetcherService } from './services/xml-fetcher.service';

// Debug toggle: disable automatic XML fetch on startup when false
const RUN_FETCH_ON_STARTUP = false; // set to false to skip xmlFetcher.runOnce()

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(PORT);
  console.log(`Nest.js API listening on PORT: ${PORT}`);
  // Manually run XML fetch once at startup (non-blocking)
  const xmlFetcher = app.get(XMLFetcherService);
  if (RUN_FETCH_ON_STARTUP) {
    xmlFetcher.runOnce();
  }
}

bootstrap();
