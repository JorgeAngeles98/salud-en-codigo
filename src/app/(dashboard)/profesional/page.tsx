import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  FilePlus, QrCode, Users, Sparkles, ShieldCheck,
  FileText, Clock, ChevronRight, Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Dashboard Profesional" };

export default async function ProfesionalPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstName = session.user.name?.split(" ")[0] ?? "Doctor/a";

  // Obtener estadísticas del profesional
  const profesional = await prisma.profesional.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [totalPacientes, fichasHoy, fichasActivas, ultimasFichas] = await Promise.all([
    profesional ? prisma.paciente.count({
      where: { registradoPorId: profesional.id, activo: true },
    }) : 0,
    profesional ? prisma.fichaClinica.count({
      where: { profesionalId: profesional.id, createdAt: { gte: hoy } },
    }) : 0,
    profesional ? prisma.fichaClinica.count({
      where: { profesionalId: profesional.id, estado: "ACTIVA" },
    }) : 0,
    profesional ? prisma.fichaClinica.findMany({
      where: { profesionalId: profesional.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, estado: true, createdAt: true,
        paciente: { select: { nombre: true } },
      },
    }) : [],
  ]);

  const ESTADO_COLOR: Record<string, string> = {
    BORRADOR: "bg-gray-100 text-gray-500",
    ACTIVA: "bg-emerald-50 text-emerald-700",
    VALIDADA: "bg-blue-50 text-blue-700",
    REVOCADA: "bg-red-50 text-red-500",
  };

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Saludo */}
      <div>
        <p className="text-xs text-gray-500">Bienvenido/a</p>
        <h1 className="text-xl font-bold text-gray-900">Hola, {firstName} 👋</h1>
      </div>

      {/* Stats del día */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{fichasHoy}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Fichas hoy</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{totalPacientes}</p>
          <p className="text-[10px] text-blue-600 mt-0.5">Pacientes</p>
        </div>
        <div className="bg-teal-50 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-teal-700">{fichasActivas}</p>
          <p className="text-[10px] text-teal-600 mt-0.5">QR activos</p>
        </div>
      </div>

      {/* Banner nueva ficha */}
      <div className="relative rounded-2xl bg-emerald-700 p-5 text-white shadow-lg overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-medium opacity-90">IA Clínica + QR</span>
        </div>
        <p className="text-lg font-bold leading-snug">Nueva Ficha Clínica</p>
        <p className="text-xs opacity-80 mt-0.5">Simplificación automática con IA</p>
        <Link
          href="/profesional/nueva-ficha"
          className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50 transition"
        >
          <FilePlus className="w-4 h-4" />
          Crear ficha
        </Link>
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/profesional/pacientes">
          <Card className="hover:border-emerald-200 hover:shadow-md transition cursor-pointer h-full">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-700">Mis Pacientes</p>
              <p className="text-[10px] text-gray-400">Registrar y gestionar</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/profesional/historial">
          <Card className="hover:border-emerald-200 hover:shadow-md transition cursor-pointer h-full">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-700">Historial</p>
              <p className="text-[10px] text-gray-400">Fichas recientes</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Fichas recientes */}
      {ultimasFichas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Últimas fichas</p>
            <Link href="/profesional/historial" className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {ultimasFichas.map((f) => (
              <div key={f.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 border border-gray-100">
                  <Activity className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{f.paciente.nombre}</p>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(f.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[f.estado] ?? "bg-gray-100 text-gray-500"}`}>
                  {f.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insignias */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: QrCode, label: "QR único", desc: "Por paciente" },
          { icon: Sparkles, label: "IA + OCR", desc: "Clínica" },
          { icon: ShieldCheck, label: "Validado", desc: "Por ti" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-emerald-50/60">
            <f.icon className="w-4 h-4 text-emerald-700" />
            <span className="text-[11px] font-semibold text-emerald-800">{f.label}</span>
            <span className="text-[9px] text-gray-500">{f.desc}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-center text-gray-400 pt-1">
        Salud en Código v1.0 · ODS 3 · Ley 29733
      </p>
    </div>
  );
}
