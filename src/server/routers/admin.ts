import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const adminRouter = router({

  // ── Stats globales ─────────────────────────────────────────────────────────
  stats: adminProcedure.query(async ({ ctx }) => {
    const centroId = ctx.centroSaludId as string;
    const [
      totalPacientes, totalFichas, fichasActivas,
      totalProfesionales, profesionalesActivos,
      totalFeedback, feedbackAvg, fichasHoy, accesosSemana,
    ] = await Promise.all([
      ctx.prisma.paciente.count({ where: { centroSaludId: centroId } }),
      ctx.prisma.fichaClinica.count({ where: { profesional: { centroSaludId: centroId } } }),
      ctx.prisma.fichaClinica.count({ where: { estado: "ACTIVA", profesional: { centroSaludId: centroId } } }),
      ctx.prisma.profesional.count({ where: { centroSaludId: centroId } }),
      ctx.prisma.profesional.count({ where: { centroSaludId: centroId, activo: true } }),
      ctx.prisma.feedback.count({ where: { ficha: { profesional: { centroSaludId: centroId } } } }),
      ctx.prisma.feedback.aggregate({
        where: { ficha: { profesional: { centroSaludId: centroId } } },
        _avg: { comprension: true, confianza: true },
      }),
      ctx.prisma.fichaClinica.count({
        where: {
          profesional: { centroSaludId: centroId },
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      ctx.prisma.logAccesoQR.count({
        where: { pinCorrecto: true, timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return {
      pacientes: { total: totalPacientes },
      fichas: { total: totalFichas, activas: fichasActivas, hoy: fichasHoy },
      profesionales: { total: totalProfesionales, activos: profesionalesActivos },
      feedback: {
        total: totalFeedback,
        promedioComprension: feedbackAvg._avg?.comprension ? Math.round(feedbackAvg._avg.comprension * 10) / 10 : null,
        promedioConfianza: feedbackAvg._avg?.confianza ? Math.round(feedbackAvg._avg.confianza * 10) / 10 : null,
      },
      accesosSemana,
    };
  }),

  // ── Métricas detalladas ────────────────────────────────────────────────────
  metricas: adminProcedure.query(async ({ ctx }) => {
    const centroId = ctx.centroSaludId as string;
    const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fichasRecientes = await ctx.prisma.fichaClinica.findMany({
      where: { profesional: { centroSaludId: centroId }, createdAt: { gte: hace7dias } },
      select: { createdAt: true, estado: true },
    });
    const porDia: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
      porDia[key] = 0;
    }
    for (const f of fichasRecientes) {
      const key = new Date(f.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
      if (key in porDia) porDia[key]++;
    }
    const estadoGroups = await ctx.prisma.fichaClinica.groupBy({
      by: ["estado"], where: { profesional: { centroSaludId: centroId } }, _count: { estado: true },
    });
    const topProfesionales = await ctx.prisma.profesional.findMany({
      where: { centroSaludId: centroId },
      include: { user: { select: { name: true } }, _count: { select: { fichas: true } } },
      orderBy: { fichas: { _count: "desc" } }, take: 5,
    });
    const feedbackDist = await ctx.prisma.feedback.groupBy({
      by: ["comprension"], where: { ficha: { profesional: { centroSaludId: centroId } } },
      _count: { comprension: true }, orderBy: { comprension: "asc" },
    });
    return {
      fichasPorDia: Object.entries(porDia).map(([fecha, total]) => ({ fecha, total })),
      estadosDist: estadoGroups.map((g) => ({ estado: g.estado, total: g._count.estado })),
      topProfesionales: topProfesionales.map((p) => ({
        nombre: p.user.name ?? "Sin nombre", especialidad: p.especialidad, totalFichas: p._count.fichas,
      })),
      feedbackDist: feedbackDist.map((f) => ({ estrellas: f.comprension, total: f._count.comprension })),
    };
  }),

  // ── Listar profesionales ───────────────────────────────────────────────────
  listProfesionales: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.profesional.findMany({
      where: { centroSaludId: ctx.centroSaludId as string },
      include: {
        user: { select: { name: true, email: true, activo: true, createdAt: true } },
        _count: { select: { fichas: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // ── Crear profesional ──────────────────────────────────────────────────────
  createProfesional: adminProcedure
    .input(z.object({
      nombre: z.string().min(2), email: z.string().email(), password: z.string().min(8),
      especialidad: z.string().min(2), colegioMedico: z.string().optional(), telefono: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const existe = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existe) throw new TRPCError({ code: "CONFLICT", message: "Ya existe un usuario con ese email" });
      const passwordHash = await bcrypt.hash(input.password, 10);
      return ctx.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: input.nombre, email: input.email, passwordHash, role: "PROFESIONAL", centroSaludId: centroId },
        });
        const profesional = await tx.profesional.create({
          data: { userId: user.id, centroSaludId: centroId, especialidad: input.especialidad, colegioMedico: input.colegioMedico, telefono: input.telefono },
        });
        await tx.auditLog.create({
          data: { tabla: "profesional", registroId: profesional.id, accion: "CREATE", userId: ctx.user.id, cambios: { after: { email: input.email, especialidad: input.especialidad } } },
        });
        return { user, profesional };
      });
    }),

  // ── Activar / desactivar profesional ──────────────────────────────────────
  toggleProfesional: adminProcedure
    .input(z.object({ profesionalId: z.string(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const profesional = await ctx.prisma.profesional.findFirst({ where: { id: input.profesionalId, centroSaludId: centroId } });
      if (!profesional) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.$transaction([
        ctx.prisma.profesional.update({ where: { id: input.profesionalId }, data: { activo: input.activo } }),
        ctx.prisma.user.update({ where: { id: profesional.userId }, data: { activo: input.activo } }),
        ctx.prisma.auditLog.create({ data: { tabla: "profesional", registroId: input.profesionalId, accion: "UPDATE", userId: ctx.user.id, cambios: { after: { activo: input.activo } } } }),
      ]);
      return { success: true };
    }),

  // ── Listar fichas del centro ───────────────────────────────────────────────
  listFichas: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      estado: z.enum(["BORRADOR","VALIDADA","ACTIVA","REVOCADA","TODAS"]).default("TODAS"),
      limit: z.number().min(1).max(100).default(30),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const where = {
        profesional: { centroSaludId: centroId },
        ...(input.estado !== "TODAS" ? { estado: input.estado } : {}),
        ...(input.search ? {
          OR: [
            { paciente: { nombre: { contains: input.search, mode: "insensitive" as const } } },
            { paciente: { dni: { contains: input.search } } },
            { diagnostico: { contains: input.search, mode: "insensitive" as const } },
          ],
        } : {}),
      };
      const fichas = await ctx.prisma.fichaClinica.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          paciente: { select: { nombre: true, dni: true, edad: true } },
          profesional: { select: { especialidad: true, user: { select: { name: true } } } },
          accesoQR: { select: { tokenOpaco: true, revocado: true, totalAccesos: true } },
        },
      });
      let nextCursor: string | undefined;
      if (fichas.length > input.limit) { const next = fichas.pop(); nextCursor = next?.id; }
      return { fichas, nextCursor };
    }),

  // ── Listar pacientes del centro (vista admin) ──────────────────────────────
  listPacientes: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(30),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const where = {
        centroSaludId: centroId,
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
        include: { _count: { select: { fichas: true } }, registradoPor: { select: { especialidad: true, user: { select: { name: true } } } } },
      });
      let nextCursor: string | undefined;
      if (pacientes.length > input.limit) { const next = pacientes.pop(); nextCursor = next?.id; }
      return { pacientes, nextCursor };
    }),

  // ── Audit log ─────────────────────────────────────────────────────────────
  listAuditLog: adminProcedure
    .input(z.object({
      tabla: z.string().optional(),
      limit: z.number().min(1).max(100).default(40),
      cursor: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.prisma.auditLog.findMany({
        where: input.tabla ? { tabla: input.tabla } : undefined,
        take: input.limit + 1,
        cursor: input.cursor ? { id: BigInt(input.cursor) } : undefined,
        orderBy: { timestamp: "desc" },
      });
      let nextCursor: number | undefined;
      if (logs.length > input.limit) { const next = logs.pop(); nextCursor = next ? Number(next.id) : undefined; }
      return {
        logs: logs.map(l => ({ ...l, id: Number(l.id) })),
        nextCursor,
      };
    }),

  // ── Feedback con comentarios ───────────────────────────────────────────────
  listFeedback: adminProcedure
    .input(z.object({
      soloConComentario: z.boolean().default(false),
      limit: z.number().min(1).max(100).default(30),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const where = {
        ficha: { profesional: { centroSaludId: centroId } },
        ...(input.soloConComentario ? { comentario: { not: null } } : {}),
      };
      const feedbacks = await ctx.prisma.feedback.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          ficha: {
            select: {
              diagnostico: true,
              paciente: { select: { nombre: true } },
              profesional: { select: { user: { select: { name: true } }, especialidad: true } },
            },
          },
        },
      });
      let nextCursor: string | undefined;
      if (feedbacks.length > input.limit) { const next = feedbacks.pop(); nextCursor = next?.id; }
      return { feedbacks, nextCursor };
    }),

  // ── Revocar QR desde admin ─────────────────────────────────────────────────
  revocarQR: adminProcedure
    .input(z.object({ fichaId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const ficha = await ctx.prisma.fichaClinica.findFirst({
        where: { id: input.fichaId, profesional: { centroSaludId: centroId } },
        include: { accesoQR: true },
      });
      if (!ficha) throw new TRPCError({ code: "NOT_FOUND" });
      if (!ficha.accesoQR) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ficha no tiene QR" });
      await ctx.prisma.$transaction([
        ctx.prisma.accesoQR.update({ where: { fichaId: input.fichaId }, data: { revocado: true } }),
        ctx.prisma.fichaClinica.update({ where: { id: input.fichaId }, data: { estado: "REVOCADA" } }),
        ctx.prisma.auditLog.create({
          data: { tabla: "ficha_clinica", registroId: input.fichaId, accion: "REVOKE", userId: ctx.user.id, cambios: { after: { motivo: "Revocado por admin" } } },
        }),
      ]);
      return { success: true };
    }),

  // ── Configuración del centro ───────────────────────────────────────────────
  getCentro: adminProcedure.query(async ({ ctx }) => {
    const centroId = ctx.centroSaludId as string;
    const centro = await ctx.prisma.centroSalud.findUnique({ where: { id: centroId } });
    if (!centro) throw new TRPCError({ code: "NOT_FOUND" });
    const totalProfs = await ctx.prisma.profesional.count({ where: { centroSaludId: centroId } });
    return { ...centro, totalProfesionales: totalProfs };
  }),

  updateCentro: adminProcedure
    .input(z.object({
      nombre: z.string().min(2),
      distrito: z.string().min(2),
      region: z.string().min(2),
      tipo: z.enum(["MINSA","ESSALUD","PRIVADO","MUNICIPAL"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const centro = await ctx.prisma.centroSalud.update({ where: { id: centroId }, data: input });
      await ctx.prisma.auditLog.create({
        data: { tabla: "centro_salud", registroId: centroId, accion: "UPDATE", userId: ctx.user.id, cambios: { after: input } },
      });
      return centro;
    }),

  // ── Exportar datos ─────────────────────────────────────────────────────────
  exportPacientes: adminProcedure.query(async ({ ctx }) => {
    const centroId = ctx.centroSaludId as string;
    const pacientes = await ctx.prisma.paciente.findMany({
      where: { centroSaludId: centroId },
      include: { _count: { select: { fichas: true } }, registradoPor: { select: { especialidad: true, user: { select: { name: true } } } } },
      orderBy: { nombre: "asc" },
    });
    return pacientes.map(p => ({
      nombre: p.nombre, dni: p.dni, edad: p.edad, sexo: p.sexo ?? "",
      condiciones: p.condiciones.join(", "),
      totalFichas: p._count.fichas,
      tieneCuenta: !!p.userId,
      registrado: p.createdAt.toISOString().split("T")[0],
    }));
  }),

  exportFichas: adminProcedure.query(async ({ ctx }) => {
    const centroId = ctx.centroSaludId as string;
    const fichas = await ctx.prisma.fichaClinica.findMany({
      where: { profesional: { centroSaludId: centroId } },
      include: {
        paciente: { select: { nombre: true, dni: true } },
        profesional: { select: { especialidad: true, user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return fichas.map(f => ({
      id: f.id,
      paciente: f.paciente.nombre, dni: f.paciente.dni,
      profesional: f.profesional.user.name ?? "", especialidad: f.profesional.especialidad,
      estado: f.estado, diagnostico: f.diagnostico ?? "",
      confianzaIA: f.aiConfidenceScore ?? "",
      fecha: f.createdAt.toISOString().split("T")[0],
    }));
  }),

  // ── Editar profesional ─────────────────────────────────────────────────────
  editProfesional: adminProcedure
    .input(z.object({
      profesionalId: z.string(),
      nombre: z.string().min(2),
      especialidad: z.string().min(2),
      colegioMedico: z.string().optional(),
      telefono: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const profesional = await ctx.prisma.profesional.findFirst({
        where: { id: input.profesionalId, centroSaludId: centroId },
      });
      if (!profesional) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.$transaction([
        ctx.prisma.user.update({
          where: { id: profesional.userId },
          data: { name: input.nombre },
        }),
        ctx.prisma.profesional.update({
          where: { id: input.profesionalId },
          data: { especialidad: input.especialidad, colegioMedico: input.colegioMedico, telefono: input.telefono },
        }),
        ctx.prisma.auditLog.create({
          data: {
            tabla: "profesional", registroId: input.profesionalId, accion: "UPDATE",
            userId: ctx.user.id, cambios: { after: { nombre: input.nombre, especialidad: input.especialidad } },
          },
        }),
      ]);
      return { success: true };
    }),

  // ── Gestionar credenciales (email / contraseña) ────────────────────────────
  updateCredencialesProfesional: adminProcedure
    .input(z.object({
      profesionalId: z.string(),
      email: z.string().email().optional(),
      password: z.string().min(8).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const profesional = await ctx.prisma.profesional.findFirst({
        where: { id: input.profesionalId, centroSaludId: centroId },
      });
      if (!profesional) throw new TRPCError({ code: "NOT_FOUND" });

      if (!input.email && !input.password) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Indica un email o una contraseña nueva" });
      }

      const data: { email?: string; passwordHash?: string } = {};

      if (input.email) {
        const existe = await ctx.prisma.user.findUnique({ where: { email: input.email } });
        if (existe && existe.id !== profesional.userId) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya existe un usuario con ese email" });
        }
        data.email = input.email;
      }
      if (input.password) {
        data.passwordHash = await bcrypt.hash(input.password, 10);
      }

      await ctx.prisma.$transaction([
        ctx.prisma.user.update({ where: { id: profesional.userId }, data }),
        ctx.prisma.auditLog.create({
          data: {
            tabla: "profesional", registroId: input.profesionalId, accion: "UPDATE",
            userId: ctx.user.id,
            cambios: { after: { emailCambiado: !!input.email, passwordReseteada: !!input.password } },
          },
        }),
      ]);
      return { success: true };
    }),

  // ── Eliminar profesional ───────────────────────────────────────────────────
  deleteProfesional: adminProcedure
    .input(z.object({ profesionalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const profesional = await ctx.prisma.profesional.findFirst({
        where: { id: input.profesionalId, centroSaludId: centroId },
        include: { _count: { select: { fichas: true } }, registradoPor: { select: { especialidad: true, user: { select: { name: true } } } } },
      });
      if (!profesional) throw new TRPCError({ code: "NOT_FOUND" });

      if (profesional._count.fichas > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No se puede eliminar: este profesional tiene ${profesional._count.fichas} ficha(s) registrada(s). Desactívalo en su lugar.`,
        });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.profesional.delete({ where: { id: input.profesionalId } }),
        ctx.prisma.user.delete({ where: { id: profesional.userId } }),
        ctx.prisma.auditLog.create({
          data: {
            tabla: "profesional", registroId: input.profesionalId, accion: "DELETE",
            userId: ctx.user.id, cambios: { after: { eliminado: true } },
          },
        }),
      ]);
      return { success: true };
    }),

  // ── Activar / desactivar cuenta de paciente ────────────────────────────────
  togglePaciente: adminProcedure
    .input(z.object({ pacienteId: z.string(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const centroId = ctx.centroSaludId as string;
      const paciente = await ctx.prisma.paciente.findFirst({
        where: { id: input.pacienteId, centroSaludId: centroId },
      });
      if (!paciente) throw new TRPCError({ code: "NOT_FOUND" });

      // Actualizar campo activo en Paciente
      await ctx.prisma.paciente.update({
        where: { id: input.pacienteId },
        data: { activo: input.activo },
      });

      // Si tiene cuenta de usuario, también bloquear/desbloquear su acceso
      if (paciente.userId) {
        await ctx.prisma.user.update({
          where: { id: paciente.userId },
          data: { activo: input.activo },
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          tabla: "paciente", registroId: input.pacienteId, accion: "UPDATE",
          userId: ctx.user.id, cambios: { after: { activo: input.activo } },
        },
      });
      return { success: true };
    }),
});
