import type { NextFunction, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';

// Dois anos, o valor da OWASP HTTP Headers Cheat Sheet. Sem preload: a lista de
// preload dos navegadores vale para o domínio registrado inteiro, e a aplicação
// roda num subdomínio.
const HSTS_MAX_AGE_SECONDS = 63_072_000;

// Cabeçalhos de segurança das respostas da API, conforme a OWASP REST Security
// Cheat Sheet. A API só devolve JSON, então a CSP não libera nenhum recurso nem
// a exibição em iframe. Fora de produção a CSP fica de fora porque bloquearia a
// interface do Swagger, que só é montada nesses ambientes.
export function securityHeaders(isProduction: boolean): RequestHandler[] {
  return [
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            useDefaults: false,
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      strictTransportSecurity: {
        maxAge: HSTS_MAX_AGE_SECONDS,
        includeSubDomains: true,
      },
      xFrameOptions: { action: 'deny' },
    }),
    noStore,
  ];
}

// As respostas trazem dados pessoais e de saúde de estudantes e não podem ficar
// guardadas no cache do navegador nem de um proxy.
function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    'Cache-Control',
    'private, no-cache, no-store, max-age=0, must-revalidate',
  );
  next();
}
