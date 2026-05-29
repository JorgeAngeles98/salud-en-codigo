"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, FileText, ThumbsUp, QrCode, Loader2, AlertCircle,
  Star, UserCheck, TrendingUp, Shield, MessageSquare, Settings, BarChart3, ShieldOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Stats {
  pacientes: { total: number };
  fichas: { total: number; activas: number; hoy: number };
  profesionales: { total: number; activos: number };
  feedback: { total: number; promedioComprension: number | null; promedioConfianza: number | null };
  accesosSemana: number;
}

async function trpcQuery<T>(path: string): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Users; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card className="border-gray-100">
      <CardContent className="p-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function QuickLink({ icon: Icon, label, desc, href, color }: {
  icon: typeof Users; label: string; desc: string; href: string; color: string;
}) {
  const router = useRouter();
  return (
    <button onClick={() => router.push(href)}
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition w-full text-left">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 truncate">{desc}</p>
      </div>
    </button>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    trpcQuery<Stats>("admin.stats")
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="px-4 py-5 space-y-5 pb-24">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Panel de Control</h1>
        <p className="text-xs text-gray-400">Resumen del centro de salud</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
      ) : stats && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard icon={Users} label="Pacientes" value={stats.pacientes.total} color="bg-emerald-50 text-emerald-600" />
            <StatCard icon={FileText} label="Fichas totales" value={stats.fichas.total}
              sub={`${stats.fichas.activas} activas · ${stats.fichas.hoy} hoy`} color="bg-blue-50 text-blue-600" />
            <StatCard icon={UserCheck} label="Profesionales" value={stats.profesionales.activos}
              sub={`de ${stats.profesionales.total} registrados`} color="bg-purple-50 text-purple-600" />
            <StatCard icon={ThumbsUp} label="Feedback" value={stats.feedback.total}
              sub={stats.feedback.promedioComprension ? `★ ${stats.feedback.promedioComprension} comprensión` : undefined}
              color="bg-amber-50 text-amber-600" />
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 text-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-700">{stats.fichas.hoy}</p>
              <p className="text-[11px] text-emerald-600">Fichas hoy</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 text-center">
              <QrCode className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-700">{stats.accesosSemana}</p>
              <p className="text-[11px] text-blue-600">Accesos QR (7 días)</p>
            </div>
          </div>

          {/* Accesos rápidos */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Gestión</p>
            <div className="space-y-2">
              <QuickLink icon={BarChart3} label="Métricas detalladas" desc="Fichas por día, top profesionales" href="/admin/metricas" color="bg-purple-50 text-purple-600" />
              <QuickLink icon={MessageSquare} label="Feedback de pacientes" desc="Comentarios y calificaciones" href="/admin/feedback" color="bg-amber-50 text-amber-600" />
              <QuickLink icon={Shield} label="Registro de auditoría" desc="Historial inmutable de acciones" href="/admin/audit" color="bg-slate-50 text-slate-600" />
              <QuickLink icon={Settings} label="Configuración" desc="Centro, límites y exportar datos" href="/admin/configuracion" color="bg-gray-50 text-gray-600" />
            </div>
          </div>

          {stats.feedback.promedioComprension && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-amber-600 fill-amber-400" />
                <p className="text-sm font-semibold text-amber-800">Satisfacción del paciente</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-bold text-amber-700">{stats.feedback.promedioComprension}/5</p>
                  <p className="text-xs text-amber-600">Comprensión</p>
                </div>
                {stats.feedback.promedioConfianza && (
                  <div>
                    <p className="text-2xl font-bold text-amber-700">{stats.feedback.promedioConfianza}/5</p>
                    <p className="text-xs text-amber-600">Confianza</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
