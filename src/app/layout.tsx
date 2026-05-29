import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Salud en Código",
    template: "%s | Salud en Código",
  },
  description:
    "Sistema de Identificación Clínica Inteligente con Tarjeta QR. Tu información médica disponible cuando más lo necesites.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Salud en Código",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#166534",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <div className="mx-auto max-w-lg min-h-screen">{children}</div>
      </body>
    </html>
  );
}
