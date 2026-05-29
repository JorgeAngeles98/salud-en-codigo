import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const pacienteAuthRouter = router({

  buscarPaciente: publicProcedure
    .input(z.object({ dni: z.string().length(8) }))
    .query(async ({ ctx, input }) => {
      const paciente = await ctx.prisma.paciente.findFirst({
        where: { dni: input.dni },
        select: { centroSaludId: true, nombre: true, userId: true, fechaNacimiento: true },
      });
      if (!paciente) return null;
      return {
        centroSaludId: paciente.centroSaludId,
        nombre: paciente.nombre,
        tieneCuenta: !!paciente.userId,
        tieneFecha: !!paciente.fechaNacimiento,
      };
    }),

  register: publicProcedure
    .input(z.object({
      dni: z.string().length(8),
      fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      centroSaludId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const paciente = await ctx.prisma.paciente.findFirst({
        where: { dni: input.dni, centroSaludId: input.centroSaludId },
      });

      if (!paciente) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No encontramos tu registro. Verifica tu DNI o consulta a tu centro de salud.",
        });
      }
      if (paciente.userId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya tienes una cuenta registrada. Ingresa con tu DNI y fecha de nacimiento.",
        });
      }
      if (!paciente.fechaNacimiento) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tu fecha de nacimiento no esta registrada. Pide a tu doctor que la actualice.",
        });
      }

      const fechaInput = new Date(input.fechaNacimiento);
      const fechaBD = new Date(paciente.fechaNacimiento);
      const mismaFecha =
        fechaInput.getUTCFullYear() === fechaBD.getUTCFullYear() &&
        fechaInput.getUTCMonth() === fechaBD.getUTCMonth() &&
        fechaInput.getUTCDate() === fechaBD.getUTCDate();

      if (!mismaFecha) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "La fecha de nacimiento no coincide con nuestros registros.",
        });
      }

      const passwordHash = await bcrypt.hash(input.dni + input.fechaNacimiento, 10);
      const user = await ctx.prisma.user.create({
        data: {
          name: paciente.nombre,
          email: `paciente_${paciente.dni}_${paciente.id}@saludcodigo.internal`,
          passwordHash,
          role: "PACIENTE",
        },
      });

      await ctx.prisma.paciente.update({
        where: { id: paciente.id },
        data: { userId: user.id },
      });

      return { success: true, nombre: paciente.nombre };
    }),

  misFichas: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "PACIENTE") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const paciente = await ctx.prisma.paciente.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!paciente) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Perfil de paciente no encontrado" });
    }

    const fichas = await ctx.prisma.fichaClinica.findMany({
      where: {
        pacienteId: paciente.id,
        estado: { in: ["ACTIVA", "REVOCADA"] },
      },
      include: {
        accesoQR: { select: { tokenOpaco: true, revocado: true, totalAccesos: true } },
        profesional: {
          select: {
            especialidad: true,
            centroSalud: { select: { nombre: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { paciente, fichas };
  }),
});
