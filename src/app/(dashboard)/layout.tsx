import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      role={session.user.role}
      userName={session.user.name}
      centroNombre={session.user.centroSaludNombre}
    >
      {children}
    </DashboardShell>
  );
}
