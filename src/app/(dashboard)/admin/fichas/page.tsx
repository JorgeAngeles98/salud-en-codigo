"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, AlertCircle, FileText, QrCode, ShieldOff, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EstadoFiltro = "TODAS" | "BORRADOR" | "VALIDADA" | "ACTIVA" | "REVOCADA";

interface Ficha {
  id: string;
  estado: string;
  diagnostico: string | null;
  createdAt: string;
  paciente: { nombre: string; dni: string; edad: number };
  profesional: { especialidad: string; user: { name: string | null } };
  accesoQR: { tokenOpaco: string; revocado: boolean; totalAccesos: number } | null;
}

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: "bg-gray-100 text-gray-600",
  VALIDADA: "bg-blue-50 text-blue-700",
  ACTIVA: "bg-emerald-50 text-emerald-700",
  REVOCADA: "bg-red-50 text-red-600",
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

async function trpcMutation<T>(path: string, input: object): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

export default function AdminFichasPage() {
  const router = useRouter();
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("TODAS");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [revocando, setRevocando] = useState<string | null>(null);

  const cargar = useCallback(async (q: string, e: EstadoFiltro) => {
    setCargando(true); setError("");
    try {
      const result = await trpcQuery<{ fichas: Ficha[] }>("admin.listFichas", { search: q || undefined, estado: e, limit: 30 });
      setFichas(result?.fichas ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar("", "TODAS"); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => cargar(busqueda, estado), 350); return () => clearTimeout(t); }, [busqueda, estado, cargar]);

  async function revocarQR(fichaId: string) {
    if (!confirm("¿Revocar el acceso QR de esta ficha? El paciente no podrá acceder con el QR anterior.")) return;
    setRevocando(fichaId);
    try {
      await trpcMutation("admin.revocarQR", { fichaId });
      cargar(busqueda, estado);
    } catch (err) { alert(err instanceof Error ? err.message : "Error al revocar"); }
    finally { setRevocando(null); }
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Fichas Clínicas</h1>
        <p className="text-xs text-gray-400">{cargando ? "Cargando..." : `${fichas.length} fichas`}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Buscar por paciente, DNI o diagnóstico..." value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)} className="pl-10 pr-10" />
        {busqueda && <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["TODAS","ACTIVA","VALIDADA","BORRADOR","REVOCADA"] as EstadoFiltro[]).map((e) => (
          <button key={e} onClick={() => setEstado(e)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition ${estado === e ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {e === "TODAS" ? "Todas" : e.charAt(0) + e.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      {cargando ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
      ) : fichas.length === 0 ? (
        <div className="text-center py-14 text-gray-400"><FileText className="w-10 h-10 mx-auto mb-2 text-gray-200" /><p className="text-sm">Sin fichas</p></div>
      ) : (
        <div className="space-y-2 pb-6">
          {fichas.map((f) => (
            <Card key={f.id} className="border-gray-100 hover:border-emerald-200 transition">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[f.estado] ?? "bg-gray-100 text-gray-600"}`}>
                        {f.estado}
                      </span>
                      {f.accesoQR && !f.accesoQR.revocado && (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                          <QrCode className="w-3 h-3" />{f.accesoQR.totalAccesos} accesos
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.paciente.nombre}</p>
                    <p className="text-xs text-gray-500">DNI {f.paciente.dni} · {f.paciente.edad} años</p>
                    <p className="text-xs text-gray-400 mt-0.5">{f.profesional.user.name} · {f.profesional.especialidad}</p>
                    {f.diagnostico && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{f.diagnostico}</p>
                    )}
                    <p className="text-[10px] text-gray-300 mt-1">{new Date(f.createdAt).toLocaleDateString("es-PE")}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {f.accesoQR && !f.accesoQR.revocado && f.estado === "ACTIVA" && (
                      <button onClick={() => revocarQR(f.id)} disabled={revocando === f.id}
                        className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition">
                        {revocando === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : <ShieldOff className="w-3.5 h-3.5 text-red-500" />}
                      </button>
                    )}
                    {f.accesoQR && !f.accesoQR.revocado && (
                      <button onClick={() => router.push(`/ficha/${f.accesoQR!.tokenOpaco}`)}
                        className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition">
                        <ChevronRight className="w-4 h-4 text-emerald-600" />
                      </button>
                    )}
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
