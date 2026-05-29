import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { authConfig } from "./auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const pacienteLoginSchema = z.object({
  dni: z.string().length(8),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),

  providers: [
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contrasena", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: { centroSalud: true },
        });

        if (!user || !user.passwordHash) return null;
        if (!user.activo) return null;
        if (!await bcrypt.compare(parsed.data.password, user.passwordHash)) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          centroSaludId: user.centroSaludId,
          centroSaludNombre: user.centroSalud?.nombre ?? null,
        };
      },
    }),

    Credentials({
      id: "paciente",
      name: "paciente",
      credentials: {
        dni: { label: "DNI", type: "text" },
        fechaNacimiento: { label: "Fecha de nacimiento", type: "text" },
      },
      async authorize(credentials) {
        const parsed = pacienteLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const paciente = await prisma.paciente.findFirst({
          where: { dni: parsed.data.dni },
          include: { user: true },
        });

        if (!paciente || !paciente.userId || !paciente.user) return null;
        if (!paciente.fechaNacimiento) return null;

        const fechaInput = new Date(parsed.data.fechaNacimiento);
        const fechaBD = new Date(paciente.fechaNacimiento);
        const mismaFecha =
          fechaInput.getUTCFullYear() === fechaBD.getUTCFullYear() &&
          fechaInput.getUTCMonth() === fechaBD.getUTCMonth() &&
          fechaInput.getUTCDate() === fechaBD.getUTCDate();

        if (!mismaFecha) return null;
        if (!paciente.user.activo) return null;

        return {
          id: paciente.user.id,
          name: paciente.nombre,
          email: paciente.user.email,
          role: "PACIENTE" as Role,
          centroSaludId: paciente.centroSaludId,
          centroSaludNombre: null,
        };
      },
    }),
  ],
});
