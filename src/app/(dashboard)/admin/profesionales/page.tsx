"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus, X, Loader2, AlertCircle, CheckCircle,
  Stethoscope, Mail, Phone, Award, Pencil, Trash2, ShieldOff, ShieldCheck, KeyRound,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Profesional {
  id: string;
  especialidad: string;
  colegioMedico: string | null;
  telefono: string | null;
  activo: boolean;
  createdAt: string;
  user: { name: string | null; email: string; activo: boolean; createdAt: string };
  _count: { fichas: number };
}

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

type Vista = "lista" | "nuevo" | "editar";

export default function AdminProfesionalesPage() {
  const [vista, setVista] = useState<Vista>("lista");
  const [tempPassword, setTempPassword] = useState<{ nombre: string; password: string } | null>(null);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Formulario nuevo
  const [formNuevo, setFormNuevo] = useState({ nombre: "", email: "", password: "", especialidad: "", colegioMedico: "", telefono: "" });
  const [creando, setCreando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  // Formulario editar
  const [editando, setEditando] = useState<Profesional | null>(null);
  const [formEditar, setFormEditar] = useState({ nombre: "", especialidad: "", colegioMedico: "", telefono: "" });
  const [guardando, setGuardando] = useState(false);

  // Gestión de credenciales
  const [formCred, setFormCred] = useState({ email: "", password: "" });
  const [guardandoCred, setGuardandoCred] = useState(false);
  const [credError, setCredError] = useState("");
  const [credExito, setCredExito] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const result = await trpcQuery<Profesional[]>("admin.listProfesionales");
      setProfesionales(result ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function mostrarExito(msg: string) {
    setExito(msg); setTimeout(() => setExito(""), 3000);
  }

  // ── Crear ──────────────────────────────────────────────────────────────────
  async function crearProfesional(e: React.FormEvent) {
    e.preventDefault(); setErrorForm(""); setCreando(true);
    try {
      await trpcMutation("admin.createProfesional", {
        nombre: formNuevo.nombre.trim(), email: formNuevo.email.trim(),
        password: formNuevo.password, especialidad: formNuevo.especialidad.trim(),
        colegioMedico: formNuevo.colegioMedico || undefined,
        telefono: formNuevo.telefono || undefined,
      });
      setFormNuevo({ nombre: "", email: "", password: "", especialidad: "", colegioMedico: "", telefono: "" });
      setVista("lista");
      mostrarExito("Profesional registrado correctamente");
      cargar();
    } catch (err) { setErrorForm(err instanceof Error ? err.message : "Error"); }
    finally { setCreando(false); }
  }

  // ── Editar ─────────────────────────────────────────────────────────────────
  function abrirEditar(p: Profesional) {
    setEditando(p);
    setFormEditar({ nombre: p.user.name ?? "", especialidad: p.especialidad, colegioMedico: p.colegioMedico ?? "", telefono: p.telefono ?? "" });
    setFormCred({ email: p.user.email, password: "" });
    setCredError(""); setCredExito("");
    setVista("editar");
    setErrorForm("");
  }

  async function guardarCredenciales() {
    setCredError(""); setCredExito("");
    const emailCambiado = formCred.email.trim() !== editando!.user.email;
    const payload: { profesionalId: string; email?: string; password?: string } = { profesionalId: editando!.id };
    if (emailCambiado) payload.email = formCred.email.trim();
    if (formCred.password) payload.password = formCred.password;
    if (!payload.email && !payload.password) {
      setCredError("Cambia el email o escribe una nueva contraseña.");
      return;
    }
    if (formCred.password && formCred.password.length < 8) {
      setCredError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setGuardandoCred(true);
    try {
      await trpcMutation("admin.updateCredencialesProfesional", payload);
      setFormCred(f => ({ ...f, password: "" }));
      setCredExito("Credenciales actualizadas. Compártelas con el profesional.");
      cargar();
    } catch (err) { setCredError(err instanceof Error ? err.message : "Error"); }
    finally { setGuardandoCred(false); }
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault(); setErrorForm(""); setGuardando(true);
    try {
      await trpcMutation("admin.editProfesional", {
        profesionalId: editando!.id,
        nombre: formEditar.nombre.trim(), especialidad: formEditar.especialidad.trim(),
        colegioMedico: formEditar.colegioMedico || undefined,
        telefono: formEditar.telefono || undefined,
      });
      setVista("lista"); mostrarExito("Datos actualizados");
      cargar();
    } catch (err) { setErrorForm(err instanceof Error ? err.message : "Error"); }
    finally { setGuardando(false); }
  }

  // ── Toggle activo ──────────────────────────────────────────────────────────
  async function toggleActivo(p: Profesional) {
    const accion = p.activo ? "desactivar" : "activar";
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${p.user.name}?`)) return;
    try {
      await trpcMutation("admin.toggleProfesional", { profesionalId: p.id, activo: !p.activo });
      mostrarExito(`Profesional ${p.activo ? "desactivado" : "activado"}`);
      cargar();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────
  async function eliminar(p: Profesional) {
    if (p._count.fichas > 0) {
      alert(`No se puede eliminar: tiene ${p._count.fichas} ficha(s). Desactívalo en su lugar.`);
      return;
    }
    if (!confirm(`¿Eliminar permanentemente a ${p.user.name}? Esta acción no se puede deshacer.`)) return;
    try {
      await trpcMutation("admin.deleteProfesional", { profesionalId: p.id });
      mostrarExito("Profesional eliminado");
      cargar();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  // ── Reset contraseña ───────────────────────────────────────────────────────
  async function resetPassword(p: Profesional) {
    if (!confirm(`¿Resetear la contraseña de ${p.user.name}? Se generará una contraseña temporal que debes entregarle.`)) return;
    try {
      const res = await trpcMutation<{ tempPassword: string }>(
        "admin.resetPasswordProfesional", { userId: p.id }
      );
      setTempPassword({ nombre: p.user.name ?? "Doctor", password: res.tempPassword });
    } catch (err) { setError(err instanceof Error ? err.message : "Error al resetear"); }
  }

  // ── Vista: Formulario nuevo ────────────────────────────────────────────────
  if (vista === "nuevo") {
    return (
      <div className="px-4 py-5 pb-28 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setVista("lista"); setErrorForm(""); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Nuevo Profesional</h1>
            <p className="text-xs text-gray-400">Crear cuenta de acceso</p>
          </div>
        </div>
        <form onSubmit={crearProfesional} className="space-y-4">
          {errorForm && <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{errorForm}</div>}
          {[
            { key: "nombre", label: "Nombre completo *", placeholder: "Dr. Juan Pérez", required: true, min: 2 },
            { key: "email", label: "Email *", placeholder: "doctor@centro.pe", required: true, type: "email" },
            { key: "password", label: "Contraseña *", placeholder: "Mínimo 8 caracteres", required: true, type: "password", min: 8 },
            { key: "especialidad", label: "Especialidad *", placeholder: "Medicina General", required: true, min: 2 },
            { key: "colegioMedico", label: "N° Colegiatura", placeholder: "CMP-12345" },
            { key: "telefono", label: "Teléfono", placeholder: "999 888 777" },
          ].map(({ key, label, placeholder, required, type, min }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</label>
              <Input type={type ?? "text"} placeholder={placeholder} required={required} minLength={min}
                value={(formNuevo as Record<string,string>)[key]}
                onChange={(e) => setFormNuevo(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={creando}>
            {creando ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Registrando...</> : "Registrar profesional"}
          </Button>
        </form>
      </div>
    );
  }

  // ── Vista: Formulario editar ───────────────────────────────────────────────
  if (vista === "editar" && editando) {
    return (
      <div className="px-4 py-5 pb-28 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setVista("lista"); setErrorForm(""); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
            <X className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Editar Profesional</h1>
            <p className="text-xs text-gray-400">{editando.user.email}</p>
          </div>
        </div>
        <form onSubmit={guardarEdicion} className="space-y-4">
          {errorForm && <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{errorForm}</div>}
          {[
            { key: "nombre", label: "Nombre completo *", placeholder: "Dr. Juan Pérez", required: true, min: 2 },
            { key: "especialidad", label: "Especialidad *", placeholder: "Medicina General", required: true, min: 2 },
            { key: "colegioMedico", label: "N° Colegiatura", placeholder: "CMP-12345" },
            { key: "telefono", label: "Teléfono", placeholder: "999 888 777" },
          ].map(({ key, label, placeholder, required, min }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</label>
              <Input placeholder={placeholder} required={required} minLength={min}
                value={(formEditar as Record<string,string>)[key]}
                onChange={(e) => setFormEditar(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={guardando}>
            {guardando ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</> : "Guardar cambios"}
          </Button>
        </form>

        {/* ── Gestión de credenciales ── */}
        <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-semibold text-gray-800">Credenciales de acceso</h2>
          </div>
          <p className="text-xs text-gray-500">
            Cambia el email o asigna una nueva contraseña para que el profesional pueda entrar.
            Comparte estos datos con el profesional de forma segura.
          </p>

          {credError && <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{credError}</div>}
          {credExito && <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs"><CheckCircle className="w-3.5 h-3.5 shrink-0" />{credExito}</div>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email de acceso</label>
            <Input type="email" placeholder="doctor@centro.pe"
              value={formCred.email}
              onChange={(e) => setFormCred(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nueva contraseña</label>
            <Input type="text" placeholder="Mínimo 8 caracteres (déjalo vacío para no cambiar)"
              minLength={8}
              value={formCred.password}
              onChange={(e) => setFormCred(f => ({ ...f, password: e.target.value }))} />
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={guardarCredenciales} disabled={guardandoCred}>
            {guardandoCred ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</> : "Actualizar credenciales"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Vista: Lista ───────────────────────────────────────────────────────────
  return (
    <>
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Profesionales</h1>
          <p className="text-xs text-gray-400">{cargando ? "Cargando..." : `${profesionales.length} registrado${profesionales.length !== 1 ? "s" : ""}`}</p>
        </div>
        <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setVista("nuevo")}>
          <UserPlus className="w-4 h-4 mr-1.5" />Nuevo
        </Button>
      </div>

      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {exito && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />{exito}</div>}

      {cargando ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
      ) : profesionales.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <Stethoscope className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">Sin profesionales registrados</p>
        </div>
      ) : (
        <div className="space-y-3 pb-6">
          {profesionales.map((p) => (
            <Card key={p.id} className={`border-gray-100 ${!p.activo ? "opacity-60" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{p.user.name}</p>
                    <p className="text-xs text-emerald-700 font-medium">{p.especialidad}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.activo ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {p.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500"><Mail className="w-3.5 h-3.5 text-gray-400" />{p.user.email}</div>
                  {p.telefono && <div className="flex items-center gap-2 text-xs text-gray-500"><Phone className="w-3.5 h-3.5 text-gray-400" />{p.telefono}</div>}
                  {p.colegioMedico && <div className="flex items-center gap-2 text-xs text-gray-500"><Award className="w-3.5 h-3.5 text-gray-400" />Colegiatura: {p.colegioMedico}</div>}
                </div>

                <p className="text-xs text-gray-400">{p._count.fichas} ficha{p._count.fichas !== 1 ? "s" : ""} creada{p._count.fichas !== 1 ? "s" : ""}</p>

                {/* Acciones */}
                <div className="flex gap-2 pt-1 border-t border-gray-50">
                  <button onClick={() => abrirEditar(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition">
                    <Pencil className="w-3.5 h-3.5" />Editar
                  </button>
                  <button onClick={() => toggleActivo(p)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${p.activo ? "text-orange-600 bg-orange-50 hover:bg-orange-100" : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"}`}>
                    {p.activo ? <><ShieldOff className="w-3.5 h-3.5" />Desactivar</> : <><ShieldCheck className="w-3.5 h-3.5" />Activar</>}
                  </button>
                  <button onClick={() => resetPassword(p)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                    title="Resetear contraseña">
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => eliminar(p)} disabled={p._count.fichas > 0}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    title={p._count.fichas > 0 ? "Tiene fichas, no se puede eliminar" : "Eliminar"}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>

      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-5">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Contrasena temporal</h3>
              <button onClick={() => setTempPassword(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Entregale esta contrasena temporal a <strong>{tempPassword.nombre}</strong>. Debera cambiarla desde su perfil.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-[11px] text-blue-400 uppercase tracking-wider mb-1">Contrasena temporal</p>
              <p className="text-2xl font-bold font-mono tracking-widest text-blue-900">{tempPassword.password}</p>
            </div>
            <p className="text-[11px] text-gray-400 text-center">Copiala antes de cerrar</p>
            <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={() => {
              navigator.clipboard.writeText(tempPassword.password);
              setTempPassword(null);
            }}>
              Copiar y cerrar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}