import { auth } from "@/lib/auth";
import { PerfilPage } from "@/components/layout/PerfilPage";

export default async function AdminPerfilPage() {
  const session = await auth();

  return (
    <PerfilPage
      nombre={session?.user?.name ?? null}
      email={session?.user?.email ?? ""}
      role={session?.user?.role ?? "ADMIN"}
      centroNombre={session?.user?.centroSaludNombre ?? null}
    />
  );
}
