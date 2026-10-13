import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ClientProviders } from "./ClientProviders";
import { MicrosoftClarity } from "@/components/MicrosoftClarity";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en">
      <head>
        <Script
          src="/runtime-config.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        data-clarity-mask="true"
      >
        <ClientProviders>
          {children}
        </ClientProviders>
        <MicrosoftClarity nonce={nonce} />
      </body>
    </html>
  );
}
