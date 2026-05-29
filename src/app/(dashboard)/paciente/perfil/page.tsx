import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PerfilPage } from "@/components/layout/PerfilPage";

export default async function PacientePerfilPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PACIENTE") redirect("/paciente-login");

  const paciente = session.user.id
    ? await prisma.paciente.findUnique({
        where: { userId: session.user.id },
        include: { centroSalud: { select: { nombre: true } } },
      })
    : null;

  return (
    <PerfilPage
      nombre={session.user.name ?? null}
      email={session.user.email ?? ""}
      role="PACIENTE"
      centroNombre={paciente?.centroSalud?.nombre ?? null}
    />
  );
}
