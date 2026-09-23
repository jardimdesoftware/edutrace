import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// O SwaggerModule registra as rotas direto no servidor HTTP, fora dos
// controllers, então o AuthGuard global não as protege. Em produção a
// documentação simplesmente não é montada, e as duas rotas respondem 404.
export function setupSwagger(
  app: INestApplication,
  isProduction: boolean,
): void {
  if (isProduction) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Documentação API pe-estudantes')
    .setDescription(
      'API criada para auxiliar estudantes com necessidades educacionais específicas.',
    )
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory);
}
