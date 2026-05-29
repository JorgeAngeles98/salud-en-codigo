import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PerfilPage } from "@/components/layout/PerfilPage";

export default async function ProfesionalPerfilPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const profesional = userId
    ? await prisma.profesional.findUnique({
        where: { userId },
        select: { especialidad: true, colegioMedico: true, telefono: true },
      })
    : null;

  return (
    <PerfilPage
      nombre={session?.user?.name ?? null}
      email={session?.user?.email ?? ""}
      role={session?.user?.role ?? "PROFESIONAL"}
      centroNombre={session?.user?.centroSaludNombre ?? null}
      especialidad={profesional?.especialidad ?? null}
      colegioMedico={profesional?.colegioMedico ?? null}
      telefono={profesional?.telefono ?? null}
    />
  );
}
