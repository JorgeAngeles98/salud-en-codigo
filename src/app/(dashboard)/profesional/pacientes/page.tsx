"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  UserPlus,
  User,
  Loader2,
  X,
  FilePlus,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Paciente {
  id: string;
  nombre: string;
  dni: string;
  edad: number;
  sexo: string | null;
  condiciones: string[];
  _count: { fichas: number };
}

const CONDICION_LABEL: Record<string, string> = {
  diabetes_tipo2: "Diabetes T2",
  hipertension: "Hipertensión",
  gestante: "Gestante",
  enfermedad_renal: "E. Renal",
  asma: "Asma",
  obesidad: "Obesidad",
};

function condicionLabel(c: string) {
  return CONDICION_LABEL[c] ?? c.replace(/_/g, " ");
}

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
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

type Vista = "lista" | "nuevo" | "editar";

const CONDICIONES_DISPONIBLES = Object.keys(CONDICION_LABEL);

const FORM_VACIO = {
  nombre: "",
  dni: "",
  edad: "",
  sexo: "",
  fechaNacimiento: "",
  condiciones: [] as string[],
};

export default function PacientesPage() {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("lista");
  const [busqueda, setBusqueda] = useState("");
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState("");
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setErrorForm("");
    setVista("nuevo");
  }

  function abrirEdicion(p: Paciente) {
    setForm({
      nombre: p.nombre,
      dni: p.dni,
      edad: String(p.edad),
      sexo: p.sexo ?? "",
      fechaNacimiento: "",
      condiciones: p.condiciones ?? [],
    });
    setEditandoId(p.id);
    setErrorForm("");
    setVista("editar");
  }

  function toggleCondicion(c: string) {
    setForm((f) => ({
      ...f,
      condiciones: f.condiciones.includes(c)
        ? f.condiciones.filter((x) => x !== c)
        : [...f.condiciones, c],
    }));
  }

  const cargarPacientes = useCallback(async (q: string) => {
    setCargando(true);
    setErrorLista("");
    try {
      const result = await trpcQuery<{ pacientes: Paciente[] }>(
        "paciente.list",
        { search: q || undefined, limit: 50 }
      );
      setPacientes(result?.pacientes ?? []);
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarPacientes("");
  }, [cargarPacientes]);

  useEffect(() => {
    const t = setTimeout(() => cargarPacientes(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda, cargarPacientes]);

  async function guardarPaciente(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm("");
    setCreando(true);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        dni: form.dni,
        edad: parseInt(form.edad),
        sexo: form.sexo || undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
        condiciones: form.condiciones,
      };
      if (vista === "editar" && editandoId) {
        await trpcMutation("paciente.update", { id: editandoId, ...datos });
      } else {
        await trpcMutation("paciente.create", datos);
      }
      setForm(FORM_VACIO);
      setEditandoId(null);
      setVista("lista");
      cargarPacientes(busqueda);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setCreando(false);
    }
  }

  // ── Formulario nuevo paciente ──────────────────────────────────────────────

  if (vista === "nuevo" || vista === "editar") {
    const esEdicion = vista === "editar";
    return (
      <div className="px-5 py-5 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setVista("lista");
              setErrorForm("");
            }}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {esEdicion ? "Editar Paciente" : "Nuevo Paciente"}
            </h1>
            <p className="text-xs text-gray-400">
              {esEdicion ? "Modifica los datos del paciente" : "Registra los datos básicos"}
            </p>
          </div>
        </div>

        <form onSubmit={guardarPaciente} className="space-y-4">
          {errorForm && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {errorForm}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Nombre completo *
            </label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: María López García"
              required
              minLength={2}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              DNI *
            </label>
            <Input
              value={form.dni}
              onChange={(e) =>
                setForm((f) => ({
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Edad *
              </label>
              <Input
                value={form.edad}
                onChange={(e) => setForm((f) => ({ ...f, edad: e.target.value }))}
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
                value={form.sexo}
                onChange={(e) => setForm((f) => ({ ...f, sexo: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Sin especificar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Fecha de nacimiento
            </label>
            <Input
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) =>
                setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))
              }
              max={new Date().toISOString().split("T")[0]}
            />
            <p className="text-[11px] text-gray-400">
              Necesaria para que el paciente pueda crear su cuenta y ver sus fichas
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Condiciones crónicas
            </label>
            <div className="flex flex-wrap gap-2">
              {CONDICIONES_DISPONIBLES.map((c) => {
                const activa = form.condiciones.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCondicion(c)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      activa
                        ? "bg-orange-50 text-orange-700 border-orange-200 font-medium"
                        : "bg-white text-gray-500 border-gray-200 hover:border-orange-200"
                    }`}
                  >
                    {condicionLabel(c)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="fixed bottom-[65px] left-0 right-0 max-w-lg mx-auto px-5 py-3 bg-white/95 backdrop-blur border-t border-gray-100">
            <Button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800"
              disabled={creando}
            >
              {creando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                esEdicion ? "Guardar cambios" : "Registrar paciente"
              )}
            </Button>
          </div>
          <div className="h-32" />
        </form>
      </div>
    );
  }

  // ── Lista de pacientes ─────────────────────────────────────────────────────

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Pacientes</h1>
          <p className="text-xs text-gray-400">
            {cargando
              ? "Cargando..."
              : `${pacientes.length} registrado${pacientes.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          size="sm"
          className="bg-emerald-700 hover:bg-emerald-800"
          onClick={abrirNuevo}
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          Nuevo
        </Button>
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
          <button
            onClick={() => setBusqueda("")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {errorLista && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {errorLista}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        </div>
      ) : pacientes.length > 0 ? (
        <div className="space-y-2 pb-6">
          {pacientes.map((p) => (
            <Card
              key={p.id}
              className="border-gray-100 hover:border-emerald-200 hover:shadow-sm transition cursor-pointer"
              onClick={() =>
                router.push(
                  `/profesional/nueva-ficha?pacienteId=${p.id}&nombre=${encodeURIComponent(p.nombre)}`
                )
              }
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {p.nombre}
                    </p>
                    {p.sexo && (
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {p.sexo === "F" ? "♀" : "♂"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    DNI: {p.dni} · {p.edad} años
                    {p._count.fichas > 0 && (
                      <span className="ml-1 text-emerald-600 font-medium">
                        · {p._count.fichas} ficha{p._count.fichas > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  {p.condiciones.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.condiciones.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100"
                        >
                          {condicionLabel(c)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEdicion(p);
                    }}
                    title="Editar paciente"
                    className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/profesional/nueva-ficha?pacienteId=${p.id}&nombre=${encodeURIComponent(p.nombre)}`
                      );
                    }}
                    title="Nueva ficha"
                    className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition"
                  >
                    <FilePlus className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
          <User className="w-10 h-10 mb-3 text-gray-200" />
          <p className="text-sm font-medium">
            {busqueda
              ? `Sin resultados para "${busqueda}"`
              : "No hay pacientes registrados"}
          </p>
          <p className="text-xs mt-1">
            {busqueda
              ? "Prueba con otro nombre o DNI"
              : "Registra el primer paciente con el botón Nuevo"}
          </p>
          {!busqueda && (
            <Button
              className="mt-4 bg-emerald-700 hover:bg-emerald-800"
              size="sm"
              onClick={abrirNuevo}
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Registrar paciente
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
