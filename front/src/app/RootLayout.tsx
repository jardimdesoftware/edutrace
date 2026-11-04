import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";

export const metadata: Metadata = {
  title: "Edutrace",
  icons: "/icon.png"
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="pt-BR">
      <head>
        <Script
          src="/runtime-config.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
      </head>
      <body className="antialiased" data-clarity-mask="true">
        <ClientProviders>
          {children}
        </ClientProviders>
        <MicrosoftClarity nonce={nonce} />
      </body>
    </html>
  );
}
