import { z } from "zod";
import { router, publicProcedure, tenantProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const feedbackRouter = router({
  // Enviar feedback (público — el paciente no necesita autenticarse)
  submit: publicProcedure
    .input(
      z.object({
        fichaId: z.string(),
        comprension: z.number().int().min(1).max(5),
        confianza: z.number().int().min(1).max(5),
        disposicionPago: z
          .enum(["CENTRO_SALUD", "PAGO_COMPARTIDO", "SOLO_PACIENTE", "NO_PAGARIA"])
          .optional(),
        comentario: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar que la ficha existe y está activa
      const ficha = await ctx.prisma.fichaClinica.findUnique({
        where: { id: input.fichaId },
      });

      if (!ficha || ficha.estado !== "ACTIVA") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ficha no encontrada o inactiva",
        });
      }

      const feedback = await ctx.prisma.feedback.create({
        data: input,
      });

      return feedback;
    }),

  // Obtener métricas agregadas (profesional/admin)
  metrics: tenantProcedure.query(async ({ ctx }) => {
    // Total de fichas activas en el centro
    const profesionales = await ctx.prisma.profesional.findMany({
      where: { centroSaludId: ctx.centroSaludId },
      select: { id: true },
    });

    const profesionalIds = profesionales.map((p) => p.id);

    const [totalFichas, totalFeedbacks, feedbacks, accesosQR] = await Promise.all([
      ctx.prisma.fichaClinica.count({
        where: {
          profesionalId: { in: profesionalIds },
          estado: "ACTIVA",
        },
      }),
      ctx.prisma.feedback.count({
        where: {
          ficha: { profesionalId: { in: profesionalIds } },
        },
      }),
      ctx.prisma.feedback.findMany({
        where: {
          ficha: { profesionalId: { in: profesionalIds } },
        },
        select: {
          comprension: true,
          confianza: true,
          disposicionPago: true,
        },
      }),
      ctx.prisma.accesoQR.aggregate({
        where: {
          ficha: { profesionalId: { in: profesionalIds } },
        },
        _sum: { totalAccesos: true },
        _count: { id: true },
      }),
    ]);

    // Calcular promedios
    const avgComprension =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + f.comprension, 0) / feedbacks.length
        : 0;

    const avgConfianza =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + f.confianza, 0) / feedbacks.length
        : 0;

    // Tasa de acceso QR
    const totalQRs = accesosQR._count.id;
    const qrsAccedidos = await ctx.prisma.accesoQR.count({
      where: {
        ficha: { profesionalId: { in: profesionalIds } },
        totalAccesos: { gt: 0 },
      },
    });
    const tasaAccesoQR = totalQRs > 0 ? (qrsAccedidos / totalQRs) * 100 : 0;

    // Distribución de disposición a pagar
    const pagoDist = feedbacks.reduce(
      (acc, f) => {
        if (f.disposicionPago) {
          acc[f.disposicionPago] = (acc[f.disposicionPago] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalFichas,
      totalFeedbacks,
      avgComprension: Math.round(avgComprension * 10) / 10,
      avgConfianza: Math.round(avgConfianza * 10) / 10,
      tasaAccesoQR: Math.round(tasaAccesoQR),
      totalAccesosQR: accesosQR._sum.totalAccesos ?? 0,
      distribucionPago: pagoDist,
      // Hipótesis de validación (del informe PMV)
      hipotesis: {
        H1: { meta: 70, actual: Math.round((avgComprension / 5) * 100) },
        H2: { meta: 50, actual: Math.round(tasaAccesoQR) },
        H3: { meta: 60, actual: Math.round((avgConfianza / 5) * 100) },
      },
    };
  }),
});
