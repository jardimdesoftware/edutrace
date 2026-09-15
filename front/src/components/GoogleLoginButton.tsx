"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/services/http";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccounts = {
  id: {
    initialize(options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
      cancel_on_tap_outside?: boolean;
    }): void;
    renderButton(
      parent: HTMLElement,
      options: Record<string, string | number>,
    ): void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

type Props = {
  onCredential: (credential: string) => void | Promise<void>;
  onError: (error: unknown) => void;
};

export function GoogleLoginButton({ onCredential, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    apiRequest("/auth/google/config", {
      auth: false,
      errorMessage: "Não foi possível carregar o login com Google",
    })
      .then((config: { enabled: boolean; clientId: string | null }) => {
        if (config.enabled && config.clientId) setClientId(config.clientId);
      })
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!scriptReady || !clientId || !containerRef.current || !window.google) {
      return;
    }

    const container = containerRef.current;
    container.replaceChildren();
    const availableWidth = Math.floor(container.getBoundingClientRect().width);

    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        if (!response.credential) {
          onError("O Google não retornou uma credencial válida.");
          return;
        }

        void onCredential(response.credential);
      },
    });

    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: Math.min(availableWidth, 360),
    });
  }, [clientId, onCredential, onError, scriptReady]);

  if (!clientId) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="flex min-h-10 w-full justify-center" />
    </>
  );
}
