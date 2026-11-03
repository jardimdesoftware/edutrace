// src/types/express.d.ts (ou em qualquer outro arquivo de tipos globais)
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    jti: string;
    roles: number[];
    email: string;
    name: string;
  };
}
