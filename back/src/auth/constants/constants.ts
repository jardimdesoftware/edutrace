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
