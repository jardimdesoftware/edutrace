import { getApiUrl } from '@/utils/runtimeApiUrl';
import { endSession } from './auth/session';

const DEFAULT_ERROR_MESSAGE = 'Erro ao processar requisição';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  endSessionOnUnauthorized?: boolean;
  errorMessage?: string;
};

async function readBody(res: Response) {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!isJson) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractErrorMessage(data: { message?: string | string[] } | null, fallback: string) {
  const message = data?.message;

  if (Array.isArray(message)) {
    return message.join(' ');
  }

  return message || fallback;
}

export async function apiRequest(path: string, options: ApiRequestOptions = {}) {
  const {
    method = 'GET',
    body,
    auth = true,
    endSessionOnUnauthorized = auth,
    errorMessage = DEFAULT_ERROR_MESSAGE,
  } = options;

  const hasBody = body !== undefined;

  // O token de sessão vai no cookie HttpOnly, que só é enviado à API com
  // credentials: 'include'. O cabeçalho X-Requested-With é exigido pelo back nas
  // requisições que alteram estado, como proteção contra CSRF.
  const res = await fetch(`${getApiUrl()}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });

  const data = await readBody(res);

  if (!res.ok) {
    if (res.status === 401 && endSessionOnUnauthorized) {
      endSession();
    }

    throw new ApiError(extractErrorMessage(data, errorMessage), res.status);
  }

  return data;
}
