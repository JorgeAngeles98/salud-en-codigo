import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * Contexto de tRPC — incluye sesión y prisma con tenant isolation
 */
export async function createContext() {
  const session = await auth();

  return {
    session,
    prisma,
    // Helper para queries con tenant isolation
    centroSaludId: session?.user?.centroSaludId ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * Middleware: requiere autenticación
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Debes iniciar sesión" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

/**
 * Middleware: requiere rol específico
 */
function enforceRole(...roles: Role[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!roles.includes(ctx.session.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Se requiere rol: ${roles.join(" o ")}`,
      });
    }
    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        user: ctx.session.user,
      },
    });
  });
}

/**
 * Middleware: tenant isolation — agrega filtro automático por centroSaludId
 */
const enforceTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.centroSaludId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Usuario no vinculado a un centro de salud",
    });
  }
  return next({
    ctx: {
      ...ctx,
      centroSaludId: ctx.session.user.centroSaludId,
    },
  });
});

// Procedures protegidos
export const protectedProcedure = t.procedure.use(enforceAuth);
export const profesionalProcedure = t.procedure.use(enforceRole("PROFESIONAL", "ADMIN")).use(enforceTenant);
export const adminProcedure = t.procedure.use(enforceRole("ADMIN"));
export const tenantProcedure = t.procedure.use(enforceAuth).use(enforceTenant);
