import type { CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Request } from 'express';

function allowedOrigins(): string[] {
  return (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

// Só uma origem listada em FRONTEND_URL recebe Access-Control-Allow-Origin e
// Access-Control-Allow-Credentials, em qualquer ambiente. Com origin: false, o
// pacote cors não escreve nenhum cabeçalho de CORS, nem os do preflight; com
// credentials: true fixo, ele anunciaria credenciais a qualquer origem. A
// proteção contra CSRF depende de o CORS recusar as outras origens
// (csrf-protection.ts).
export const corsOptions: CorsOptionsDelegate<Request> = (req, callback) => {
  const origin = req.header('Origin');
  const allowed = !!origin && allowedOrigins().includes(origin);

  callback(null, allowed ? { origin, credentials: true } : { origin: false });
};
