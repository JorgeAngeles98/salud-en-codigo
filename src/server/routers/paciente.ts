import { z } from "zod";
import { router, profesionalProcedure, tenantProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const pacienteRouter = router({
  // Crear paciente (solo profesional) — guarda quién lo registró
  create: profesionalProcedure
    .input(z.object({
      nombre: z.string().min(2, "Nombre requerido"),
      dni: z.string().min(8, "DNI debe tener al menos 8 caracteres"),
      edad: z.number().int().min(0).max(120),
      fechaNacimiento: z.string().optional(),
      sexo: z.enum(["M", "F"]).optional(),
      condiciones: z.array(z.string()).default([]),
      telefono: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.paciente.findUnique({
        where: { dni_centroSaludId: { dni: input.dni, centroSaludId: ctx.centroSaludId } },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Ya existe un paciente con ese DNI en este centro" });
      }

      // Obtener el profesionalId a partir del userId
      const profesional = await ctx.prisma.profesional.findUnique({
        where: { userId: ctx.user.id },
      });

      const paciente = await ctx.prisma.paciente.create({
        data: {
          ...input,
          fechaNacimiento: input.fechaNacimiento ? new Date(input.fechaNacimiento) : undefined,
          centroSaludId: ctx.centroSaludId,
          registradoPorId: profesional?.id ?? undefined,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          tabla: "paciente", registroId: paciente.id, accion: "CREATE",
          userId: ctx.user.id, cambios: { after: input },
        },
      });

      return paciente;
    }),

  // Editar paciente — solo quien lo registró (o un admin del centro)
  update: profesionalProcedure
    .input(z.object({
      id: z.string(),
      nombre: z.string().min(2, "Nombre requerido"),
      dni: z.string().min(8, "DNI debe tener al menos 8 caracteres"),
      edad: z.number().int().min(0).max(120),
      fechaNacimiento: z.string().optional(),
      sexo: z.enum(["M", "F"]).optional(),
      condiciones: z.array(z.string()).default([]),
      telefono: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // El paciente debe existir y pertenecer a este centro
      const paciente = await ctx.prisma.paciente.findFirst({
        where: { id: input.id, centroSaludId: ctx.centroSaludId },
      });
      if (!paciente) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Paciente no encontrado" });
      }

      // Permiso: solo quien lo registró, o un admin (sin registro de profesional)
      const profesional = await ctx.prisma.profesional.findUnique({
        where: { userId: ctx.user.id },
      });
      if (profesional && paciente.registradoPorId !== profesional.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el profesional que registró al paciente puede editarlo",
        });
      }

      // Si cambió el DNI, verificar que no choque con otro paciente del centro
      if (input.dni !== paciente.dni) {
        const dniEnUso = await ctx.prisma.paciente.findUnique({
          where: { dni_centroSaludId: { dni: input.dni, centroSaludId: ctx.centroSaludId } },
        });
        if (dniEnUso) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya existe otro paciente con ese DNI en este centro" });
        }
      }

      const { id, fechaNacimiento, ...resto } = input;
      const actualizado = await ctx.prisma.paciente.update({
        where: { id },
        data: {
          ...resto,
          fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : undefined,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          tabla: "paciente", registroId: id, accion: "UPDATE",
          userId: ctx.user.id,
          cambios: {
            before: { nombre: paciente.nombre, dni: paciente.dni, edad: paciente.edad, condiciones: paciente.condiciones, telefono: paciente.telefono, sexo: paciente.sexo },
            after: resto,
          },
        },
      });

      return actualizado;
    }),

  // Listar solo los pacientes registrados por este profesional
  list: profesionalProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Obtener el profesionalId
      const profesional = await ctx.prisma.profesional.findUnique({
        where: { userId: ctx.user.id },
      });

      const where = {
        centroSaludId: ctx.centroSaludId,
        // Si es profesional (no admin), solo ve sus propios pacientes
        ...(profesional ? { registradoPorId: profesional.id } : {}),
        ...(input.search ? {
          OR: [
            { nombre: { contains: input.search, mode: "insensitive" as const } },
            { dni: { contains: input.search } },
          ],
        } : {}),
      };

      const pacientes = await ctx.prisma.paciente.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { fichas: true } } },
      });

      let nextCursor: string | undefined;
      if (pacientes.length > input.limit) {
        const next = pacientes.pop();
        nextCursor = next?.id;
      }

      return { pacientes, nextCursor };
    }),

  // Obtener paciente por ID (solo del propio centro)
  getById: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const paciente = await ctx.prisma.paciente.findFirst({
        where: { id: input.id, centroSaludId: ctx.centroSaludId },
        include: {
          fichas: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, version: true, estado: true, diagnostico: true, createdAt: true },
          },
        },
      });
      if (!paciente) throw new TRPCError({ code: "NOT_FOUND", message: "Paciente no encontrado" });
      return paciente;
    }),

  findByDni: profesionalProcedure
    .input(z.object({ dni: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.paciente.findFirst({
        where: { dni: input.dni, centroSaludId: ctx.centroSaludId },
      });
    }),
});
