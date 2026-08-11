declare global {
  interface Window {
    __ENV__?: {
      API_URL?: string;
      CLARITY_PROJECT_ID?: string;
    };
  }
}

export function getApiUrl() {
  if (typeof window !== 'undefined') {
    const runtimeApiUrl = window.__ENV__?.API_URL;

    if (runtimeApiUrl) {
      return runtimeApiUrl;
    }
  }

  return process.env.NEXT_PUBLIC_API_EDU_TRACE || '';
}
