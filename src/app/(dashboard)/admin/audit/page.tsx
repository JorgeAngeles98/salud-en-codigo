"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, Shield, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AuditLog {
  id: number; tabla: string; registroId: string; accion: string;
  userId: string | null; cambios: unknown; ip: string | null; timestamp: string;
}

const ACCION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-blue-50 text-blue-700",
  VALIDATE: "bg-purple-50 text-purple-700",
  REVOKE: "bg-red-50 text-red-600",
  ACCESS: "bg-orange-50 text-orange-700",
  DELETE: "bg-red-100 text-red-800",
};

const TABLA_ICON: Record<string, string> = {
  paciente: "👤", ficha_clinica: "📋", profesional: "🩺", centro_salud: "🏥", acceso_qr: "🔲",
};

async function trpcQuery<T>(path: string, input?: object): Promise<T> {
  const url = input
    ? `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `/api/trpc/${path}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tablaFiltro, setTablaFiltro] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async (tabla: string) => {
    setCargando(true); setError("");
    try {
      const result = await trpcQuery<{ logs: AuditLog[] }>("admin.listAuditLog", { tabla: tabla || undefined, limit: 50 });
      setLogs(result?.logs ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(""); }, [cargar]);

  const tablas = ["", "paciente", "ficha_clinica", "profesional", "centro_salud"];

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Registro de Auditoría</h1>
          <p className="text-xs text-gray-400">Historial inmutable de acciones</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => cargar(tablaFiltro)} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />Actualizar
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tablas.map((t) => (
          <button key={t} onClick={() => { setTablaFiltro(t); cargar(t); }}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition ${tablaFiltro === t ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {t === "" ? "Todos" : TABLA_ICON[t] + " " + t.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      {cargando ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-14 text-gray-400"><Shield className="w-10 h-10 mx-auto mb-2 text-gray-200" /><p className="text-sm">Sin registros</p></div>
      ) : (
        <div className="space-y-2 pb-6">
          {logs.map((log) => (
            <Card key={log.id} className="border-gray-100">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="text-xl shrink-0 mt-0.5">{TABLA_ICON[log.tabla] ?? "📝"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ACCION_COLOR[log.accion] ?? "bg-gray-100 text-gray-600"}`}>
                        {log.accion}
                      </span>
                      <span className="text-xs text-gray-600 font-medium">{log.tabla.replace("_", " ")}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono truncate">ID: {log.registroId}</p>
                    {log.cambios && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        {JSON.stringify((log.cambios as Record<string, unknown>).after ?? log.cambios).slice(0, 80)}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-[10px] text-gray-300">{new Date(log.timestamp).toLocaleString("es-PE")}</p>
                      {log.ip && <p className="text-[10px] text-gray-300">IP: {log.ip}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
