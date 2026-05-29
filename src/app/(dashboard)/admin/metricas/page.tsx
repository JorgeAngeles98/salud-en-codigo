"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, BarChart3, TrendingUp, Star, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Metricas {
  fichasPorDia: { fecha: string; total: number }[];
  estadosDist: { estado: string; total: number }[];
  topProfesionales: { nombre: string | null; especialidad: string; totalFichas: number }[];
  feedbackDist: { estrellas: number; total: number }[];
}

async function trpcQuery<T>(path: string): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: "bg-gray-300",
  VALIDADA: "bg-blue-400",
  ACTIVA: "bg-emerald-500",
  REVOCADA: "bg-red-400",
};

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  VALIDADA: "Validada",
  ACTIVA: "Activa",
  REVOCADA: "Revocada",
};

export default function MetricasPage() {
  const [data, setData] = useState<Metricas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    trpcQuery<Metricas>("admin.metricas")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-5">
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  const m = data!;
  const maxFichas = Math.max(...m.fichasPorDia.map((d) => d.total), 1);
  const totalFichas = m.estadosDist.reduce((s, e) => s + e.total, 0);
  const totalFeedback = m.feedbackDist.reduce((s, f) => s + f.total, 0);

  return (
    <div className="px-5 py-5 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Metricas detalladas</h1>
        <p className="text-xs text-gray-400">Ultimos 7 dias y acumulado</p>
      </div>

      {/* Fichas por día */}
      <Card className="border-gray-100">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-gray-800">Fichas creadas por dia</p>
          </div>
          <div className="flex items-end gap-2 h-28">
            {m.fichasPorDia.map((d) => (
              <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500 font-medium">
                  {d.total > 0 ? d.total : ""}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
                  <div
                    className="w-full bg-emerald-500 rounded-t-md transition-all"
                    style={{
                      height: `${Math.max((d.total / maxFichas) * 100, d.total > 0 ? 8 : 2)}%`,
                      opacity: d.total === 0 ? 0.15 : 1,
                    }}
                  />
                </div>
                <span className="text-[9px] text-gray-400 text-center leading-tight">
                  {d.fecha}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Distribución de estados */}
      {totalFichas > 0 && (
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-800">Estado de fichas</p>
            </div>
            <div className="space-y-2.5">
              {m.estadosDist.map((e) => (
                <div key={e.estado}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{ESTADO_LABEL[e.estado] ?? e.estado}</span>
                    <span className="text-xs font-semibold text-gray-700">
                      {e.total} ({Math.round((e.total / totalFichas) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${ESTADO_COLOR[e.estado] ?? "bg-gray-400"}`}
                      style={{ width: `${(e.total / totalFichas) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top profesionales */}
      {m.topProfesionales.length > 0 && (
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-600" />
              <p className="text-sm font-semibold text-gray-800">Profesionales mas activos</p>
            </div>
            <div className="space-y-2">
              {m.topProfesionales.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {p.nombre ?? "Sin nombre"}
                    </p>
                    <p className="text-xs text-gray-400">{p.especialidad}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 shrink-0">
                    {p.totalFichas}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribución de feedback */}
      {totalFeedback > 0 && (
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-yellow-500" />
              <p className="text-sm font-semibold text-gray-800">
                Comprension de los pacientes
              </p>
            </div>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((estrella) => {
                const item = m.feedbackDist.find((f) => f.estrellas === estrella);
                const total = item?.total ?? 0;
                return (
                  <div key={estrella} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-6 text-right">{estrella}★</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-yellow-400"
                        style={{
                          width: `${totalFeedback > 0 ? (total / totalFeedback) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-6">{total}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-right">
              Total: {totalFeedback} respuesta{totalFeedback !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      )}

      {totalFichas === 0 && (
        <div className="text-center py-10 text-gray-400">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Sin datos aun</p>
          <p className="text-xs mt-1">Las metricas apareceran cuando se creen fichas</p>
        </div>
      )}
    </div>
  );
}
