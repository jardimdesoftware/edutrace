import { SetMetadata } from '@nestjs/common';
export const jwtConstants = {
  secret: process.env.SECRET_KEY,
};

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Requisições por minuto, por IP, nas rotas públicas de autenticação quando
// AUTH_RATE_LIMIT não está definida. Fica abaixo de uma força bruta de 10
// tentativas por minuto, que precisa receber 429: o bloqueio por conta
// responde o mesmo 401 de credencial inválida.
export const AUTH_RATE_LIMIT_DEFAULT = 8;

// Limite das rotas de autenticação, aplicado com @Throttle sobre o
// ThrottlerModule do AppModule. O padrão é de 8 requisições por minuto em cada
// rota, contadas por IP nas rotas públicas e por usuário nas que exigem
// sessão. AUTH_RATE_LIMIT e AUTH_RATE_LIMIT_TTL_MS substituem o limite e a
// janela, para elevar o teto quando uma escola inteira sai por um único IP
// público (NAT) ou para testes de carga.
export const AUTH_THROTTLE = {
  default: {
    limit: Number(process.env.AUTH_RATE_LIMIT) || AUTH_RATE_LIMIT_DEFAULT,
    ttl: Number(process.env.AUTH_RATE_LIMIT_TTL_MS) || 60_000,
  },
};
