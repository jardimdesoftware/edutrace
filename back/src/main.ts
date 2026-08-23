import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { validateSecretKey } from './common/validate-secret-key';

async function bootstrap() {
  validateSecretKey();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Sem isto, o limite por IP das rotas de autenticação enxergaria apenas o
  // endereço do proxy reverso e trataria todos os usuários como um cliente só.
  app.set('trust proxy', 1);

  const port = process.env.PORT ?? 3000;

  const isProduction = process.env.NODE_ENV === 'production';
  const origins = process.env.FRONTEND_URL?.split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  app.enableCors({
    origin: isProduction ? origins : true,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Documentação API pe-estudantes')
    .setDescription(
      'API criada para auxiliar estudantes com necessidades educacionais específicas.',
    )
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory);

  await app.listen(port);
}

// Start application
bootstrap().catch((err) => {
  console.error('Erro ao iniciar a aplicação:', err);
  process.exit(1);
});
