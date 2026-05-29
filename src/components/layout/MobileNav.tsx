"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, User, Users, ShieldCheck, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}

const profesionalNav: NavItem[] = [
  { href: "/profesional", label: "Inicio", icon: Home, exact: true },
  { href: "/profesional/pacientes", label: "Pacientes", icon: Users },
  { href: "/profesional/historial", label: "Historial", icon: History },
  { href: "/profesional/perfil", label: "Perfil", icon: User },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: Home, exact: true },
  { href: "/admin/pacientes", label: "Pacientes", icon: Users },
  { href: "/admin/fichas", label: "Fichas", icon: FileText },
  { href: "/admin/profesionales", label: "Equipo", icon: ShieldCheck },
  { href: "/admin/perfil", label: "Perfil", icon: User },
];

const pacienteNav: NavItem[] = [
  { href: "/paciente", label: "Inicio", icon: Home, exact: true },
  { href: "/paciente/historial", label: "Historial", icon: History },
  { href: "/paciente/perfil", label: "Perfil", icon: User },
];

export function MobileNav({ role }: { role: "PROFESIONAL" | "PACIENTE" | "ADMIN" }) {
  const pathname = usePathname();
  const items =
    role === "PACIENTE" ? pacienteNav : role === "ADMIN" ? adminNav : profesionalNav;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 pb-safe">
      <div className="mx-auto max-w-lg flex items-center justify-around px-1 py-2">
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[52px]",
                isActive
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
