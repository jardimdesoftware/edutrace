import type { INestApplication } from '@nestjs/common';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  register,
} from 'prom-client';

let configured = false;

export function setupMetrics(app: INestApplication): void {
  if (configured) return;

  collectDefaultMetrics({ prefix: 'edutrace_' });

  const requests = new Counter({
    name: 'edutrace_http_requests_total',
    help: 'Total de requisições HTTP processadas pela API.',
    labelNames: ['method', 'status_class'] as const,
  });
  const duration = new Histogram({
    name: 'edutrace_http_request_duration_seconds',
    help: 'Duração das requisições HTTP da API em segundos.',
    labelNames: ['method', 'status_class'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  const server = app.getHttpAdapter().getInstance() as Express;
  server.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics') return next();

    const stop = duration.startTimer({ method: req.method });
    res.once('finish', () => {
      const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
      requests.inc({ method: req.method, status_class: statusClass });
      stop({ status_class: statusClass });
    });
    next();
  });

  server.get('/metrics', async (_req: Request, res: Response) => {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  configured = true;
}
