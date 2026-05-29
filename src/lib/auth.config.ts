import type { NextAuthConfig } from "next-auth";

// Configuración ligera compatible con Edge Runtime (middleware)
// NO puede contener PrismaAdapter ni imports de Node.js
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  providers: [], // Los providers reales están en auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.centroSaludId = (user as { centroSaludId: string | null }).centroSaludId;
        token.centroSaludNombre = (user as { centroSaludNombre: string | null }).centroSaludNombre;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.centroSaludId = token.centroSaludId as string | null;
        session.user.centroSaludNombre = token.centroSaludNombre as string | null;
      }
      return session;
    },
  },
};
