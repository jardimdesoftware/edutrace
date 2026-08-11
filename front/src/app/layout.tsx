import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script src="/runtime-config.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        data-clarity-mask="true"
      >
        <ClientProviders>
          {children}
        </ClientProviders>
        <MicrosoftClarity />
      </body>
    </html>
  );
}
