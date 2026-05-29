"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, X, Loader2, AlertCircle, User, FileText,
  ShieldCheck, ShieldOff, CheckCircle, ChevronRight,
  Stethoscope, Calendar, Phone, Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Paciente {
  id: string; nombre: string; dni: string; edad: number;
  sexo: string | null; condiciones: string[]; userId: string | null;
  activo: boolean; telefono: string | null; createdAt: string;
  fechaNacimiento: string | null;
  _count: { fichas: number };
  registradoPor: { especialidad: string; user: { name: string | null } } | null;
}

const CONDICION_LABEL: Record<string, string> = {
  diabetes_tipo2: "Diabetes T2", hipertension: "Hipertensión", gestante: "Gestante",
  enfermedad_renal: "E. Renal", asma: "Asma", obesidad: "Obesidad",
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

function ModalDetalle({ paciente, onClose, onToggle, toggling }: {
  paciente: Paciente;
  onClose: () => void;
  onToggle: (p: Paciente) => void;
  toggling: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl flex flex-col"
        style={{ maxHeight: "calc(100vh - 70px)", marginBottom: "65px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fijo */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">Detalle del Paciente</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 pb-8">

          {/* Avatar + nombre */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <User className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">{paciente.nombre}</p>
              <p className="text-sm text-gray-500">DNI: {paciente.dni}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${paciente.activo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {paciente.activo ? "Activo" : "Inactivo"}
                </span>
                {paciente.userId && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />Tiene cuenta
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Edad / Sexo</p>
              <p className="text-sm font-semibold text-gray-800">
                {paciente.edad} años · {paciente.sexo === "F" ? "Femenino" : paciente.sexo === "M" ? "Masculino" : "—"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Fichas</p>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                {paciente._count.fichas} ficha{paciente._count.fichas !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Doctor que registró */}
          <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-600 uppercase tracking-wider">Registrado por</p>
              <p className="text-sm font-semibold text-emerald-900">
                {paciente.registradoPor?.user.name ?? "Sin asignar"}
              </p>
              {paciente.registradoPor?.especialidad && (
                <p className="text-xs text-emerald-700">{paciente.registradoPor.especialidad}</p>
              )}
            </div>
          </div>

          {/* Condiciones */}
          {paciente.condiciones.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Activity className="w-3 h-3" />Condiciones crónicas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {paciente.condiciones.map((c) => (
                  <span
                    key={c}
                    className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100 font-medium"
                  >
                    {CONDICION_LABEL[c] ?? c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Datos extra */}
          <div className="space-y-1.5">
            {paciente.telefono && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />{paciente.telefono}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4 text-gray-400" />
              Registrado el {new Date(paciente.createdAt).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>

          {/* Botón toggle */}
          <button
            onClick={() => onToggle(paciente)}
            disabled={toggling}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition ${
              paciente.activo
                ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            {toggling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : paciente.activo ? (
              <span className="flex items-center gap-1.5"><ShieldOff className="w-4 h-4" />Desactivar acceso</span>
            ) : (
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />Activar acceso</span>
            )}
          </button>

        </div>{/* fin scrollable */}
      </div>
    </div>
  );
}

export default function AdminPacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Paciente | null>(null);

  const cargar = useCallback(async (q: string) => {
    setCargando(true); setError("");
    try {
      const result = await trpcQuery<{ pacientes: Paciente[] }>("admin.listPacientes", { search: q || undefined, limit: 50 });
      setPacientes(result?.pacientes ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(""); }, [cargar]);
  useEffect(() => {
    const t = setTimeout(() => cargar(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda, cargar]);

  function mostrarExito(msg: string) { setExito(msg); setTimeout(() => setExito(""), 3000); }

  async function toggleActivo(p: Paciente) {
    if (!confirm(`¿${p.activo ? "Desactivar" : "Activar"} a ${p.nombre}?`)) return;
    setToggling(p.id);
    try {
      await trpcMutation("admin.togglePaciente", { pacienteId: p.id, activo: !p.activo });
      mostrarExito(`Paciente ${p.activo ? "desactivado" : "activado"}`);
      setDetalle(null);
      cargar(busqueda);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setToggling(null); }
  }

  const activos = pacientes.filter(p => p.activo).length;

  return (
    <>
      <div className="px-4 py-5 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Pacientes</h1>
          <p className="text-xs text-gray-400">
            {cargando ? "Cargando..." : `${pacientes.length} registrados · ${activos} activos`}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o DNI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-10 pr-10"
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
        {exito && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />{exito}
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          </div>
        ) : pacientes.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <User className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">Sin pacientes registrados</p>
          </div>
        ) : (
          <div className="space-y-2 pb-6">
            {pacientes.map((p) => (
              <Card
                key={p.id}
                className={`border-gray-100 hover:border-emerald-200 transition cursor-pointer ${!p.activo ? "opacity-60" : ""}`}
                onClick={() => setDetalle(p)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.nombre}</p>
                      {p.sexo && <span className="text-[10px] text-gray-400">{p.sexo === "F" ? "♀" : "♂"}</span>}
                      {!p.activo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-medium shrink-0">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">DNI: {p.dni} · {p.edad} años</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {p.registradoPor && (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" />{p.registradoPor.user.name}
                        </span>
                      )}
                      {p._count.fichas > 0 && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <FileText className="w-3 h-3" />{p._count.fichas} ficha{p._count.fichas > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {detalle && (
        <ModalDetalle
          paciente={detalle}
          onClose={() => setDetalle(null)}
          onToggle={toggleActivo}
          toggling={toggling === detalle.id}
        />
      )}
    </>
  );
}
