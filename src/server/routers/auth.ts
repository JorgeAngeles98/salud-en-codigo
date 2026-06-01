import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const authRouter = router({
  // Cambiar contraseña
  changePassword: protectedProcedure
    .input(z.object({
      actual: z.string().min(1),
      nueva: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id }, select: { passwordHash: true },
      });
      if (!user?.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta cuenta no tiene contraseña configurada" });
      const valida = await bcrypt.compare(input.actual, user.passwordHash);
      if (!valida) throw new TRPCError({ code: "UNAUTHORIZED", message: "La contraseña actual es incorrecta" });
      const hash = await bcrypt.hash(input.nueva, 10);
      await ctx.prisma.user.update({ where: { id: ctx.user.id }, data: { passwordHash: hash } });
      return { success: true };
    }),

  // Datos del perfil actual
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { id: true, name: true, email: true, role: true, centroSaludId: true, centroSalud: { select: { nombre: true } } },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const profesional = user.role === "PROFESIONAL"
      ? await ctx.prisma.profesional.findUnique({ where: { userId: user.id }, select: { especialidad: true, colegioMedico: true, telefono: true } })
      : null;
    return { ...user, profesional };
  }),

  // Actualizar perfil (nombre + datos profesional si aplica)
  updateProfile: protectedProcedure
    .input(z.object({
      nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
      especialidad: z.string().min(2).optional(),
      colegioMedico: z.string().optional(),
      telefono: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { name: input.nombre },
      });
      if (ctx.user.role === "PROFESIONAL" && input.especialidad) {
        await ctx.prisma.profesional.update({
          where: { userId: ctx.user.id },
          data: {
            especialidad: input.especialidad,
            colegioMedico: input.colegioMedico ?? undefined,
            telefono: input.telefono ?? undefined,
          },
        });
      }
      return { success: true };
    }),

  // Registro de nuevo profesional (requiere código de invitación del centro)
  registro: publicProcedure
    .input(z.object({
      nombre: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(8),
      especialidad: z.string().min(3),
      colegioMedico: z.string().optional(),
      codigoInvitacion: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verificar código de invitación (coincide con el ID o nombre del centro)
      const centro = await ctx.prisma.centroSalud.findFirst({
        where: {
          OR: [
            { id: input.codigoInvitacion },
            { nombre: { contains: input.codigoInvitacion, mode: "insensitive" } },
          ],
          suscripcionActiva: true,
        },
      });

      if (!centro) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código de invitación inválido. Solicítalo al administrador de tu centro.",
        });
      }

      // Verificar límite de profesionales
      const countProfesionales = await ctx.prisma.profesional.count({
        where: { centroSaludId: centro.id, activo: true },
      });
      if (countProfesionales >= centro.maxProfesionales) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El centro ha alcanzado el límite de profesionales activos.",
        });
      }

      // Verificar email único
      const existe = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existe) {
        throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cuenta con ese email." });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);

      // Crear usuario + profesional en transacción
      const user = await ctx.prisma.user.create({
        data: {
          name: input.nombre,
          email: input.email,
          passwordHash,
          role: "PROFESIONAL",
          centroSaludId: centro.id,
          activo: false, // Requiere activación por admin
        },
      });

      await ctx.prisma.profesional.create({
        data: {
          userId: user.id,
          centroSaludId: centro.id,
          especialidad: input.especialidad,
          colegioMedico: input.colegioMedico,
          activo: false,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          tabla: "profesional",
          registroId: user.id,
          accion: "CREATE",
          cambios: { after: { nombre: input.nombre, email: input.email, centroId: centro.id } },
        },
      });

      return { success: true };
    }),

  // Solicitar recuperación de contraseña
  forgotPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: { id: true, name: true, email: true, passwordHash: true },
      });

      // Siempre retornamos éxito para no exponer si el email existe
      if (!user || !user.passwordHash) return { success: true };

      // Invalidar tokens anteriores para este email
      await ctx.prisma.passwordResetToken.updateMany({
        where: { email: input.email.toLowerCase(), used: false },
        data: { used: true },
      });

      // Crear nuevo token (expira en 1 hora)
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await ctx.prisma.passwordResetToken.create({
        data: {
          email: input.email.toLowerCase(),
          token,
          expires,
        },
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/recuperar-contrasena/reset?token=${token}`;

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@saludencod.igo",
        to: input.email,
        subject: "Recupera tu contraseña — Salud en Código",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #065f46;">Salud en Código</h2>
            <p>Hola${user.name ? ` ${user.name}` : ""},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            <p>
              <a href="${resetUrl}"
                 style="display: inline-block; background: #065f46; color: white;
                        padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Restablecer contraseña
              </a>
            </p>
            <p style="color: #6b7280; font-size: 13px;">
              Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este mensaje.
            </p>
          </div>
        `,
      });

      return { success: true };
    }),

  // Confirmar nueva contraseña con token
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      nuevaPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      const resetToken = await ctx.prisma.passwordResetToken.findUnique({
        where: { token: input.token },
      });

      if (!resetToken || resetToken.used || resetToken.expires < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El enlace es inválido o ha expirado. Solicita uno nuevo.",
        });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { email: resetToken.email },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado." });
      }

      const passwordHash = await bcrypt.hash(input.nuevaPassword, 10);

      await ctx.prisma.$transaction([
        ctx.prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        }),
        ctx.prisma.passwordResetToken.update({
          where: { token: input.token },
          data: { used: true },
        }),
      ]);

      return { success: true };
    }),
});
