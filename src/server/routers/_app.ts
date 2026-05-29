import { router } from "../trpc";
import { pacienteRouter } from "./paciente";
import { fichaRouter } from "./ficha";
import { feedbackRouter } from "./feedback";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { pacienteAuthRouter } from "./pacienteAuth";

export const appRouter = router({
  paciente: pacienteRouter,
  ficha: fichaRouter,
  feedback: feedbackRouter,
  admin: adminRouter,
  auth: authRouter,
  pacienteAuth: pacienteAuthRouter,
});

export type AppRouter = typeof appRouter;
