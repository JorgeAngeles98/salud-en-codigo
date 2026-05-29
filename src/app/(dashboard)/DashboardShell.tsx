"use client";

import { signOut } from "next-auth/react";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import type { Role } from "@prisma/client";

interface Props {
  role: Role;
  userName?: string | null;
  centroNombre?: string | null;
  children: React.ReactNode;
}

export function DashboardShell({ role, userName, centroNombre, children }: Props) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader
        userName={userName}
        centroNombre={centroNombre}
        onSignOut={() => signOut({ callbackUrl: "/login" })}
      />
      <main className="flex-1 pb-20">{children}</main>
      <MobileNav role={role as "PROFESIONAL" | "PACIENTE" | "ADMIN"} />
    </div>
  );
}
