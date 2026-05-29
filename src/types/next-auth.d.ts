import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      centroSaludId: string | null;
      centroSaludNombre: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    centroSaludId: string | null;
    centroSaludNombre: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    centroSaludId: string | null;
    centroSaludNombre: string | null;
  }
}
