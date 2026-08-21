import { getApiUrl } from '@/utils/runtimeApiUrl';
import { endSession, getToken } from './auth/session';

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

  const token = auth ? getToken() : null;
  const hasBody = body !== undefined;

  const res = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });

  const data = await readBody(res);

  if (!res.ok) {
    if (res.status === 401 && endSessionOnUnauthorized) {
      endSession();
    }

    throw new Error(extractErrorMessage(data, errorMessage));
  }

  return data;
}
