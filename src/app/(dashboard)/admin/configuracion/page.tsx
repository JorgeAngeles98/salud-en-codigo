"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle, Settings, Download, Users, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Centro {
  id: string; nombre: string; distrito: string; region: string;
  tipo: string; maxProfesionales: number; totalProfesionales: number;
}

type TipoCentro = "MINSA" | "ESSALUD" | "PRIVADO" | "MUNICIPAL";

async function trpcQuery<T>(path: string, input?: object): Promise<T> {
  const url = input
    ? `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `/api/trpc/${path}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

async function trpcMutation<T>(path: string, input: object): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

function descargarCSV(datos: object[], nombre: string) {
  if (!datos.length) return;
  const cols = Object.keys(datos[0]);
  const csv = [cols.join(","), ...datos.map((row) =>
    cols.map((c) => `"${String((row as Record<string, unknown>)[c] ?? "").replace(/"/g, '""')}"`).join(",")
  )].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminConfiguracionPage() {
  const [centro, setCentro] = useState<Centro | null>(null);
  const [form, setForm] = useState({ nombre: "", distrito: "", region: "", tipo: "MINSA" as TipoCentro });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  useEffect(() => {
    trpcQuery<Centro>("admin.getCentro").then((c) => {
      setCentro(c);
      setForm({ nombre: c.nombre, distrito: c.distrito, region: c.region, tipo: c.tipo as TipoCentro });
      setCargando(false);
    }).catch((err) => { setError(err.message); setCargando(false); });
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setError(""); setExito(""); setGuardando(true);
    try {
      await trpcMutation("admin.updateCentro", form);
      setExito("Datos actualizados correctamente");
      setTimeout(() => setExito(""), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setGuardando(false); }
  }

  async function exportar(tipo: "pacientes" | "fichas") {
    setExportando(tipo);
    try {
      const datos = await trpcQuery<object[]>(`admin.export${tipo === "pacientes" ? "Pacientes" : "Fichas"}`);
      descargarCSV(datos, `${tipo}_${new Date().toISOString().split("T")[0]}.csv`);
    } catch (err) { setError(err instanceof Error ? err.message : "Error al exportar"); }
    finally { setExportando(null); }
  }

  if (cargando) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>;

  return (
    <div className="px-4 py-5 space-y-5 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Configuración</h1>
        <p className="text-xs text-gray-400">Centro de salud y exportación de datos</p>
      </div>

      {/* Capacidad */}
      {centro && (
        <Card className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-gray-800">Capacidad del centro</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (centro.totalProfesionales / centro.maxProfesionales) * 100)}%` }} />
              </div>
              <p className="text-sm font-semibold text-gray-700 shrink-0">
                {centro.totalProfesionales} / {centro.maxProfesionales}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {centro.maxProfesionales - centro.totalProfesionales} slots disponibles
            </p>
          </CardContent>
        </Card>
      )}

      {/* Formulario del centro */}
      <form onSubmit={guardar} className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-4 h-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-800">Datos del centro</p>
        </div>

        {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        {exito && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{exito}</div>}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nombre del centro</label>
          <Input value={form.nombre} onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))} required minLength={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Distrito</label>
            <Input value={form.distrito} onChange={(e) => setForm(f => ({ ...f, distrito: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Región</label>
            <Input value={form.region} onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo de centro</label>
          <select value={form.tipo} onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value as TipoCentro }))}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="MINSA">MINSA</option>
            <option value="ESSALUD">EsSalud</option>
            <option value="PRIVADO">Privado</option>
            <option value="MUNICIPAL">Municipal</option>
          </select>
        </div>
        <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={guardando}>
          {guardando ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</> : "Guardar cambios"}
        </Button>
      </form>

      {/* Exportación */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-800">Exportar datos</p>
        </div>
        <p className="text-xs text-gray-400">Descarga archivos CSV para reportes o análisis externos.</p>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => exportar("pacientes")} disabled={!!exportando}>
            {exportando === "pacientes" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4 text-emerald-600" />}
            Exportar lista de pacientes (.csv)
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => exportar("fichas")} disabled={!!exportando}>
            {exportando === "fichas" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-emerald-600" />}
            Exportar fichas clínicas (.csv)
          </Button>
        </div>
      </div>
    </div>
  );
}
