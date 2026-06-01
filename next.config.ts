import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Orígenes permitidos para acceder al servidor de desarrollo desde
  // otros dispositivos (ngrok / red local). Sin esto, Next.js 16 bloquea
  // las peticiones de origen cruzado al dev server y el login falla.
  allowedDevOrigins: [
    "galore-snap-morale.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
    // Para acceso por IP de red local añade aquí tu IP, p. ej. "192.168.1.50"
  ],

  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Turbopack: WebSocket HMR accesible desde red local
  turbopack: {
    // Fija la raíz del workspace a esta carpeta para evitar que Next.js
    // elija por error el package-lock.json de C:\Users\jorge como raíz.
    root: path.resolve(__dirname),
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
