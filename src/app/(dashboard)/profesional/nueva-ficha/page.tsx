"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  UserPlus,
  Check,
  Loader2,
  User,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Paciente {
  id: string;
  nombre: string;
  dni: string;
  edad: number;
  sexo: string | null;
  condiciones: string[];
  _count: { fichas: number };
}

type Paso = "seleccionar" | "nuevo-paciente";

// ── Helpers tRPC ───────────────────────────────────────────────────────────────

async function trpcQuery<T>(path: string, input?: object): Promise<T> {
  const url = input
    ? `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `/api/trpc/${path}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error en consulta");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

async function trpcMutation<T>(path: string, input: object): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error en operación");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function NuevaFichaPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("seleccionar");

  // Estado búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<Paciente | null>(null);

  // Estado form nuevo paciente
  const [formNuevo, setFormNuevo] = useState({
    nombre: "",
    dni: "",
    edad: "",
    sexo: "",
  });
  const [creando, setCreando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  // ── Búsqueda con debounce ────────────────────────────────────────────────────

  const buscarPacientes = useCallback(async (q: string) => {
    setBuscando(true);
    try {
      const result = await trpcQuery<{ pacientes: Paciente[] }>(
        "paciente.list",
        { search: q || undefined, limit: 10 }
      );
      setPacientes(result?.pacientes ?? []);
    } catch {
      setPacientes([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => buscarPacientes(busqueda), 350);
    return () => clearTimeout(timer);
  }, [busqueda, buscarPacientes]);

  // Carga inicial de pacientes
  useEffect(() => {
    buscarPacientes("");
  }, [buscarPacientes]);

  // ── Crear nuevo paciente ─────────────────────────────────────────────────────

  async function crearPaciente(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm("");
    setCreando(true);
    try {
      const nuevo = await trpcMutation<Paciente>("paciente.create", {
        nombre: formNuevo.nombre.trim(),
        dni: formNuevo.dni,
        edad: parseInt(formNuevo.edad),
        sexo: formNuevo.sexo || undefined,
        condiciones: [],
      });
      // Seleccionar el nuevo paciente y volver al paso de selección
      setPacienteSeleccionado({ ...nuevo, _count: { fichas: 0 } });
      setBusqueda(nuevo.nombre);
      setPaso("seleccionar");
      setFormNuevo({ nombre: "", dni: "", edad: "", sexo: "" });
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al crear paciente");
    } finally {
      setCreando(false);
    }
  }

  // ── Continuar a paso 2 ───────────────────────────────────────────────────────

  function continuar() {
    if (!pacienteSeleccionado) return;
    router.push(
      `/profesional/nueva-ficha/texto?pacienteId=${pacienteSeleccionado.id}&nombre=${encodeURIComponent(pacienteSeleccionado.nombre)}`
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: Seleccionar paciente
  // ════════════════════════════════════════════════════════════════════════════

  if (paso === "seleccionar") {
    return (
      <div className="px-5 py-5 space-y-4">
        {/* Sub-header con back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Nueva Ficha</h1>
            <p className="text-xs text-gray-400">Paso 1 de 3 · Selecciona el paciente</p>
          </div>
        </div>

        {/* Indicador de pasos */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full ${
                n === 1 ? "bg-emerald-600" : "bg-gray-100"
              }`}
            />
          ))}
        </div>

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o DNI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-10 pr-10"
            autoFocus
          />
          {busqueda && (
            <button
              onClick={() => {
                setBusqueda("");
                setPacienteSeleccionado(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Paciente seleccionado (chip) */}
        {pacienteSeleccionado && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-900 truncate">
                {pacienteSeleccionado.nombre}
              </p>
              <p className="text-xs text-emerald-700">
                DNI: {pacienteSeleccionado.dni} · {pacienteSeleccionado.edad} años
              </p>
            </div>
            <button
              onClick={() => setPacienteSeleccionado(null)}
              className="shrink-0"
            >
              <X className="w-4 h-4 text-emerald-500" />
            </button>
          </div>
        )}

        {/* Lista de resultados */}
        <div className="space-y-2">
          {buscando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            </div>
          ) : pacientes.length > 0 ? (
            <>
              {!busqueda && (
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold px-1">
                  Pacientes recientes
                </p>
              )}
              {pacientes.map((p) => (
                <Card
                  key={p.id}
                  onClick={() => setPacienteSeleccionado(p)}
                  className={`cursor-pointer transition hover:border-emerald-300 hover:shadow-sm ${
                    pacienteSeleccionado?.id === p.id
                      ? "border-emerald-500 bg-emerald-50/60"
                      : "border-gray-100"
                  }`}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {p.nombre}
                      </p>
                      <p className="text-xs text-gray-500">
                        DNI: {p.dni} · {p.edad} años
                        {p._count.fichas > 0
                          ? ` · ${p._count.fichas} ficha${p._count.fichas > 1 ? "s" : ""}`
                          : ""}
                      </p>
                      {p.condiciones.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.condiciones.slice(0, 3).map((c) => (
                            <span
                              key={c}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100"
                            >
                              {c.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {pacienteSeleccionado?.id === p.id ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-200 shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <User className="w-9 h-9 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">
                {busqueda
                  ? `Sin resultados para "${busqueda}"`
                  : "No hay pacientes registrados aún"}
              </p>
              <p className="text-xs mt-1">
                {busqueda
                  ? "Registra un nuevo paciente con el botón de abajo"
                  : "Empieza registrando el primer paciente"}
              </p>
            </div>
          )}
        </div>

        {/* Footer fijo con botones */}
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 py-4 bg-white/95 backdrop-blur border-t border-gray-100 space-y-2">
          <Button
            onClick={continuar}
            className="w-full bg-emerald-700 hover:bg-emerald-800"
            disabled={!pacienteSeleccionado}
          >
            {pacienteSeleccionado
              ? `Continuar con ${pacienteSeleccionado.nombre.split(" ")[0]}`
              : "Selecciona un paciente para continuar"}
            {pacienteSeleccionado && (
              <ChevronRight className="w-4 h-4 ml-1" />
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setErrorForm("");
              setFormNuevo({ nombre: "", dni: "", edad: "", sexo: "" });
              setPaso("nuevo-paciente");
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Registrar nuevo paciente
          </Button>
        </div>

        {/* Spacer para el footer fijo */}
        <div className="h-28" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: Formulario nuevo paciente
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="px-5 py-5 space-y-4">
      {/* Sub-header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setPaso("seleccionar");
            setErrorForm("");
          }}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Nuevo Paciente</h1>
          <p className="text-xs text-gray-400">Registra los datos básicos</p>
        </div>
      </div>

      {/* Indicador de pasos */}
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full ${
              n === 1 ? "bg-emerald-600" : "bg-gray-100"
            }`}
          />
        ))}
      </div>

      <form onSubmit={crearPaciente} className="space-y-4">
        {errorForm && (
          <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
            {errorForm}
          </div>
        )}

        {/* Nombre */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Nombre completo *
          </label>
          <Input
            value={formNuevo.nombre}
            onChange={(e) =>
              setFormNuevo((f) => ({ ...f, nombre: e.target.value }))
            }
            placeholder="Ej: María López García"
            required
            minLength={2}
            autoFocus
          />
        </div>

        {/* DNI */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            DNI *
          </label>
          <Input
            value={formNuevo.dni}
            onChange={(e) =>
              setFormNuevo((f) => ({
                ...f,
                dni: e.target.value.replace(/\D/g, "").slice(0, 8),
              }))
            }
            placeholder="12345678"
            required
            minLength={8}
            maxLength={8}
            inputMode="numeric"
          />
        </div>

        {/* Edad + Sexo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Edad *
            </label>
            <Input
              value={formNuevo.edad}
              onChange={(e) =>
                setFormNuevo((f) => ({ ...f, edad: e.target.value }))
              }
              placeholder="45"
              required
              type="number"
              min="0"
              max="120"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Sexo
            </label>
            <select
              value={formNuevo.sexo}
              onChange={(e) =>
                setFormNuevo((f) => ({ ...f, sexo: e.target.value }))
              }
              className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Sin especificar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
          Las condiciones crónicas (diabetes, hipertensión, etc.) se podrán
          agregar desde el perfil del paciente después de registrarlo.
        </p>

        {/* Footer fijo */}
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 py-4 bg-white/95 backdrop-blur border-t border-gray-100">
          <Button
            type="submit"
            className="w-full bg-emerald-700 hover:bg-emerald-800"
            disabled={creando}
          >
            {creando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Registrando...
              </>
            ) : (
              "Registrar y continuar →"
            )}
          </Button>
        </div>
        <div className="h-20" />
      </form>
    </div>
  );
}
