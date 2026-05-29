import { z } from "zod";
import { router, profesionalProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { generateOpaqueToken, generatePin } from "@/lib/utils";

export const fichaRouter = router({
  // Crear ficha clínica (solo profesional)
  create: profesionalProcedure
    .input(
      z.object({
        pacienteId: z.string(),
        textoOriginal: z.string().min(10, "El texto clínico debe tener al menos 10 caracteres"),
        fuenteDatos: z.enum(["TEXTO", "PDF", "IMAGEN"]).default("TEXTO"),
        archivoUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar que el paciente pertenece al mismo centro
      const paciente = await ctx.prisma.paciente.findFirst({
        where: {
          id: input.pacienteId,
          centroSaludId: ctx.centroSaludId,
        },
      });

      if (!paciente) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Paciente no encontrado en este centro",
        });
      }

      // Obtener el profesional vinculado al usuario
      const profesional = await ctx.prisma.profesional.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profesional) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No tienes perfil de profesional configurado",
        });
      }

      // Calcular la siguiente versión para este paciente
      const lastFicha = await ctx.prisma.fichaClinica.findFirst({
        where: { pacienteId: input.pacienteId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const version = (lastFicha?.version ?? 0) + 1;

      // Crear la ficha en estado BORRADOR
      const ficha = await ctx.prisma.fichaClinica.create({
        data: {
          pacienteId: input.pacienteId,
          profesionalId: profesional.id,
          version,
          estado: "BORRADOR",
          fuenteDatos: input.fuenteDatos,
          textoOriginal: input.textoOriginal,
          archivoUrl: input.archivoUrl,
        },
      });

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          tabla: "ficha_clinica",
          registroId: ficha.id,
          accion: "CREATE",
          userId: ctx.user.id,
          cambios: {
            after: {
              pacienteId: input.pacienteId,
              version,
              fuenteDatos: input.fuenteDatos,
            },
          },
        },
      });

      // TODO: En Fase 3, aquí se encola el job de IA
      // await enqueueAIJob(ficha.id, input.textoOriginal);

      return ficha;
    }),

  // Validar ficha (profesional aprueba la simplificación de IA)
  validate: profesionalProcedure
    .input(
      z.object({
        fichaId: z.string(),
        diagnostico: z.string().min(1),
        tratamiento: z.string().min(1),
        indicaciones: z.string().min(1),
        signosAlarma: z.string().min(1),
        proximoControl: z.string().optional(),
        notasValidacion: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { fichaId, ...data } = input;

      const ficha = await ctx.prisma.fichaClinica.findFirst({
        where: { id: fichaId },
        include: { profesional: { include: { centroSalud: true } } },
      });

      if (!ficha || ficha.profesional.centroSaludId !== ctx.centroSaludId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (ficha.estado !== "BORRADOR") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo se pueden validar fichas en estado BORRADOR",
        });
      }

      // Generar QR token y PIN
      const tokenOpaco = generateOpaqueToken();
      const pin = generatePin();
      const pinHash = await bcrypt.hash(pin, 10);

      // Actualizar ficha + crear acceso QR en una transacción
      const [updatedFicha] = await ctx.prisma.$transaction([
        ctx.prisma.fichaClinica.update({
          where: { id: fichaId },
          data: {
            ...data,
            estado: "ACTIVA",
            validadaPor: ctx.user.id,
            validadaEn: new Date(),
          },
        }),
        ctx.prisma.accesoQR.create({
          data: {
            fichaId,
            tokenOpaco,
            pinHash,
          },
        }),
        ctx.prisma.auditLog.create({
          data: {
            tabla: "ficha_clinica",
            registroId: fichaId,
            accion: "VALIDATE",
            userId: ctx.user.id,
            cambios: {
              after: {
                estado: "ACTIVA",
                diagnostico: data.diagnostico.substring(0, 50) + "...",
              },
            },
          },
        }),
      ]);

      return {
        ficha: updatedFicha,
        qr: {
          token: tokenOpaco,
          pin, // Se muestra UNA vez al profesional para entregar al paciente
          url: `${process.env.NEXT_PUBLIC_APP_URL}/ficha/${tokenOpaco}`,
        },
      };
    }),

  // Acceso público a ficha vía QR token + PIN (paciente)
  accessByToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
        pin: z.string().length(4, "PIN debe ser de 4 dígitos"),
      })
    )
    .query(async ({ ctx, input }) => {
      const acceso = await ctx.prisma.accesoQR.findUnique({
        where: { tokenOpaco: input.token },
        include: {
          ficha: {
            include: {
              paciente: {
                select: { nombre: true, edad: true, condiciones: true },
              },
              profesional: {
                select: {
                  especialidad: true,
                  centroSalud: { select: { nombre: true } },
                },
              },
            },
          },
        },
      });

      if (!acceso || acceso.revocado) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ficha no encontrada o acceso revocado",
        });
      }

      if (acceso.ficha.estado !== "ACTIVA") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta ficha ya no está activa",
        });
      }

      // Verificar PIN
      const pinValid = await bcrypt.compare(input.pin, acceso.pinHash);
      if (!pinValid) {
        // Log intento fallido
        await ctx.prisma.logAccesoQR.create({
          data: {
            accesoQRId: acceso.id,
            pinCorrecto: false,
          },
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "PIN incorrecto",
        });
      }

      // Log acceso exitoso + incrementar contador
      await ctx.prisma.$transaction([
        ctx.prisma.logAccesoQR.create({
          data: {
            accesoQRId: acceso.id,
            pinCorrecto: true,
          },
        }),
        ctx.prisma.accesoQR.update({
          where: { id: acceso.id },
          data: { totalAccesos: { increment: 1 } },
        }),
      ]);

      // Retornar solo la info simplificada (nunca el texto original)
      return {
        fichaId: acceso.fichaId,
        paciente: acceso.ficha.paciente,
        profesional: acceso.ficha.profesional,
        diagnostico: acceso.ficha.diagnostico,
        tratamiento: acceso.ficha.tratamiento,
        indicaciones: acceso.ficha.indicaciones,
        signosAlarma: acceso.ficha.signosAlarma,
        proximoControl: acceso.ficha.proximoControl,
        validadaEn: acceso.ficha.validadaEn,
        version: acceso.ficha.version,
      };
    }),

  // Listar fichas del centro (profesional)
  list: profesionalProcedure
    .input(
      z.object({
        pacienteId: z.string().optional(),
        estado: z.enum(["BORRADOR", "VALIDADA", "ACTIVA", "REVOCADA"]).optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const profesional = await ctx.prisma.profesional.findUnique({
        where: { userId: ctx.user.id },
      });

      return ctx.prisma.fichaClinica.findMany({
        where: {
          profesionalId: profesional?.id,
          ...(input.pacienteId ? { pacienteId: input.pacienteId } : {}),
          ...(input.estado ? { estado: input.estado } : {}),
        },
        take: input.limit,
        orderBy: { createdAt: "desc" },
        include: {
          paciente: { select: { nombre: true, dni: true, edad: true } },
          accesoQR: { select: { totalAccesos: true, revocado: true } },
          _count: { select: { feedback: true } },
        },
      });
    }),

  // Revocar acceso QR (profesional)
  revokeQR: profesionalProcedure
    .input(z.object({ fichaId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const acceso = await ctx.prisma.accesoQR.findUnique({
        where: { fichaId: input.fichaId },
        include: {
          ficha: {
            include: { profesional: true },
          },
        },
      });

      if (!acceso || acceso.ficha.profesional.centroSaludId !== ctx.centroSaludId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.accesoQR.update({
          where: { id: acceso.id },
          data: { revocado: true },
        }),
        ctx.prisma.fichaClinica.update({
          where: { id: input.fichaId },
          data: { estado: "REVOCADA" },
        }),
        ctx.prisma.auditLog.create({
          data: {
            tabla: "acceso_qr",
            registroId: acceso.id,
            accion: "REVOKE",
            userId: ctx.user.id,
          },
        }),
      ]);

      return { success: true };
    }),

  // Regenerar QR + PIN para una ficha activa (el doctor lo comparte de nuevo)
  regenerarQR: profesionalProcedure
    .input(z.object({ fichaId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ficha = await ctx.prisma.fichaClinica.findFirst({
        where: { id: input.fichaId },
        include: {
          profesional: true,
          accesoQR: true,
        },
      });

      if (!ficha || ficha.profesional.centroSaludId !== ctx.centroSaludId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ficha no encontrada" });
      }

      if (ficha.estado !== "ACTIVA") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo se puede regenerar el QR de fichas activas",
        });
      }

      const tokenOpaco = generateOpaqueToken();
      const pin = generatePin();
      const pinHash = await bcrypt.hash(pin, 10);

      if (ficha.accesoQR) {
        // Actualizar token y PIN existente
        await ctx.prisma.accesoQR.update({
          where: { id: ficha.accesoQR.id },
          data: { tokenOpaco, pinHash, revocado: false },
        });
      } else {
        // Crear nuevo AccesoQR si no existe
        await ctx.prisma.accesoQR.create({
          data: { fichaId: input.fichaId, tokenOpaco, pinHash },
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          tabla: "acceso_qr",
          registroId: input.fichaId,
          accion: "UPDATE",
          userId: ctx.user.id,
          cambios: { after: { accion: "regenerar_qr" } },
        },
      });

      return {
        token: tokenOpaco,
        pin,
      };
    }),
});
