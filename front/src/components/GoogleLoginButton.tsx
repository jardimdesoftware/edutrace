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
  const initializedClientIdRef = useRef<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonWidth, setButtonWidth] = useState(320);

  useEffect(() => {
    apiRequest("/auth/google/config", {
      auth: false,
      errorMessage: "Nao foi possivel carregar o login com Google",
    })
      .then((config: { enabled: boolean; clientId: string | null }) => {
        if (config.enabled && config.clientId) setClientId(config.clientId);
      })
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const updateWidth = () => {
      const availableWidth = Math.floor(container.getBoundingClientRect().width);
      if (availableWidth > 0) {
        setButtonWidth(Math.min(availableWidth, 400));
      }
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [clientId]);

  useEffect(() => {
    if (!scriptReady || !clientId || !containerRef.current || !window.google) {
      return;
    }

    if (initializedClientIdRef.current !== clientId) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response) => {
          if (!response.credential) {
            onError("O Google nao retornou uma credencial valida.");
            return;
          }

          void onCredential(response.credential);
        },
      });
      initializedClientIdRef.current = clientId;
    }

    const container = containerRef.current;
    container.replaceChildren();
    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: buttonWidth,
    });
  }, [buttonWidth, clientId, onCredential, onError, scriptReady]);

  if (!clientId) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div
        ref={containerRef}
        className="flex h-11 w-full items-center justify-center overflow-hidden rounded-lg border border-[#d4e1f2] bg-white shadow-[0_2px_7px_rgba(29,78,135,0.08)] [&>div]:!w-full [&_iframe]:!m-0 [&_iframe]:!w-full"
      />
    </>
  );
}
