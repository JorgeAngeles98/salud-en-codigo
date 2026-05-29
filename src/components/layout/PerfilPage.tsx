"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  User, Mail, Building2, LogOut, Lock, Loader2, CheckCircle2,
  AlertCircle, ChevronRight, Stethoscope, Pencil, X, Phone, Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PerfilPageProps {
  nombre: string | null;
  email: string;
  role: string;
  centroNombre: string | null;
  especialidad?: string | null;
  colegioMedico?: string | null;
  telefono?: string | null;
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

type Seccion = "main" | "editar" | "password";

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador", PROFESIONAL: "Profesional de Salud", PACIENTE: "Paciente",
};
const ROL_COLOR: Record<string, string> = {
  ADMIN: "bg-blue-50 text-blue-700", PROFESIONAL: "bg-emerald-50 text-emerald-700", PACIENTE: "bg-sky-50 text-sky-700",
};
const ROL_BG: Record<string, string> = {
  ADMIN: "from-emerald-700 to-green-900", PROFESIONAL: "from-emerald-500 to-teal-600", PACIENTE: "from-sky-500 to-blue-600",
};

export function PerfilPage({ nombre, email, role, centroNombre, especialidad, colegioMedico, telefono }: PerfilPageProps) {
  const [seccion, setSeccion] = useState<Seccion>("main");
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");
  const [error, setError] = useState("");

  // Form editar perfil
  const [editForm, setEditForm] = useState({
    nombre: nombre ?? "",
    especialidad: especialidad ?? "",
    colegioMedico: colegioMedico ?? "",
    telefono: telefono ?? "",
  });
  const [nombreActual, setNombreActual] = useState(nombre ?? "");

  // Form contraseña
  const [pwForm, setPwForm] = useState({ actual: "", nueva: "", confirmar: "" });

  function mostrarExito(msg: string) { setExito(msg); setTimeout(() => setExito(""), 2500); }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault(); setError(""); setGuardando(true);
    try {
      await trpcMutation("auth.updateProfile", {
        nombre: editForm.nombre.trim(),
        especialidad: editForm.especialidad || undefined,
        colegioMedico: editForm.colegioMedico || undefined,
        telefono: editForm.telefono || undefined,
      });
      setNombreActual(editForm.nombre.trim());
      setSeccion("main");
      mostrarExito("Perfil actualizado correctamente");
    } catch (e) { setError(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setGuardando(false); }
  }

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (pwForm.nueva !== pwForm.confirmar) { setError("Las contraseñas no coinciden"); return; }
    if (pwForm.nueva.length < 8) { setError("Mínimo 8 caracteres"); return; }
    setGuardando(true);
    try {
      await trpcMutation("auth.changePassword", { actual: pwForm.actual, nueva: pwForm.nueva });
      setPwForm({ actual: "", nueva: "", confirmar: "" });
      setSeccion("main");
      mostrarExito("Contraseña actualizada");
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setGuardando(false); }
  }

  const iniciales = (nombreActual || email).slice(0, 2).toUpperCase();

  // ── Vista: Editar perfil ─────────────────────────────────────────────────
  if (seccion === "editar") {
    return (
      <div className="px-5 py-5 space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSeccion("main"); setError(""); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Editar Perfil</h1>
            <p className="text-xs text-gray-400">Actualiza tu información</p>
          </div>
        </div>

        <form onSubmit={guardarPerfil} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nombre completo *</label>
            <Input value={editForm.nombre} required minLength={2} autoFocus
              onChange={(e) => setEditForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email</label>
            <Input value={email} disabled className="bg-gray-50 text-gray-400" />
            <p className="text-[11px] text-gray-400">El email no se puede cambiar</p>
          </div>

          {role === "PROFESIONAL" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Especialidad *</label>
                <Input value={editForm.especialidad} required minLength={2}
                  placeholder="Medicina General"
                  onChange={(e) => setEditForm(f => ({ ...f, especialidad: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">N° Colegiatura</label>
                <Input value={editForm.colegioMedico} placeholder="CMP-12345"
                  onChange={(e) => setEditForm(f => ({ ...f, colegioMedico: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Teléfono</label>
                <Input value={editForm.telefono} placeholder="999 888 777" inputMode="tel"
                  onChange={(e) => setEditForm(f => ({ ...f, telefono: e.target.value }))} />
              </div>
            </>
          )}

          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 py-4 bg-white/95 backdrop-blur border-t border-gray-100">
            <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={guardando}>
              {guardando ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</> : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ── Vista: Cambiar contraseña ────────────────────────────────────────────
  if (seccion === "password") {
    return (
      <div className="px-5 py-5 space-y-4 pb-24">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSeccion("main"); setError(""); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Cambiar contraseña</h1>
            <p className="text-xs text-gray-400">Mínimo 8 caracteres</p>
          </div>
        </div>

        <form onSubmit={cambiarPassword} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
          {[
            { key: "actual", label: "Contraseña actual" },
            { key: "nueva", label: "Nueva contraseña" },
            { key: "confirmar", label: "Confirmar nueva contraseña" },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</label>
              <Input type="password" value={(pwForm as Record<string,string>)[key]} required
                minLength={key !== "actual" ? 8 : undefined}
                onChange={(e) => setPwForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}

          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 py-4 bg-white/95 backdrop-blur border-t border-gray-100">
            <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={guardando}>
              {guardando ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Actualizando...</> : "Actualizar contraseña"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ── Vista principal ──────────────────────────────────────────────────────
  return (
    <div className="pb-24">
      {/* Header con avatar integrado */}
      <div className={`bg-gradient-to-br ${ROL_BG[role] ?? "from-gray-500 to-gray-700"} px-5 pt-6 pb-6`}>
        <p className="text-white/70 text-[11px] uppercase tracking-widest mb-3">Mi Perfil</p>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-md">
            <span className="text-white font-bold text-xl">{iniciales}</span>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">{nombreActual || "Sin nombre"}</p>
            <span className="text-white/75 text-xs mt-0.5 block">{ROL_LABEL[role] ?? role}</span>
          </div>
        </div>
      </div>

      {/* Separador */}
      <div className="h-4" />

      {exito && (
        <div className="mx-5 mb-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{exito}
        </div>
      )}

      <div className="px-5 space-y-4">
        {/* Información */}
        <Card className="border-gray-100 overflow-hidden">
          <CardContent className="p-0 divide-y divide-gray-50">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Email</p>
                <p className="text-sm text-gray-800 truncate">{email}</p>
              </div>
            </div>

            {centroNombre && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Centro de Salud</p>
                  <p className="text-sm text-gray-800 truncate">{centroNombre}</p>
                </div>
              </div>
            )}

            {especialidad && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Especialidad</p>
                  <p className="text-sm text-gray-800">{especialidad}</p>
                </div>
              </div>
            )}

            {colegioMedico && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">N° Colegiatura</p>
                  <p className="text-sm text-gray-800">{colegioMedico}</p>
                </div>
              </div>
            )}

            {telefono && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Teléfono</p>
                  <p className="text-sm text-gray-800">{telefono}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acciones */}
        <div className="space-y-2">
          <button onClick={() => { setSeccion("editar"); setError(""); setEditForm({ nombre: nombreActual, especialidad: especialidad ?? "", colegioMedico: colegioMedico ?? "", telefono: telefono ?? "" }); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 active:scale-[0.98] transition text-left">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Pencil className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Editar información</p>
              <p className="text-xs text-gray-400">Nombre, especialidad, teléfono</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          <button onClick={() => { setSeccion("password"); setError(""); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-100 hover:bg-gray-50 active:scale-[0.98] transition text-left">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Cambiar contraseña</p>
              <p className="text-xs text-gray-400">Actualiza tu acceso</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>

          <button onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-red-100 hover:bg-red-50 active:scale-[0.98] transition text-left">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-600">Cerrar sesión</p>
              <p className="text-xs text-red-400">Salir de la aplicación</p>
            </div>
          </button>
        </div>

        <p className="text-[10px] text-center text-gray-300 py-2">
          Salud en Código v1.0 · Ley 29733 · ODS 3
        </p>
      </div>
    </div>
  );
}
