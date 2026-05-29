"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Mail, Lock, User, Stethoscope, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

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

export default function RegistroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    confirmar: "",
    especialidad: "",
    colegioMedico: "",
    codigoInvitacion: "",
  });

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      await trpcMutation("auth.registro", {
        nombre: form.nombre.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        especialidad: form.especialidad.trim(),
        colegioMedico: form.colegioMedico.trim() || undefined,
        codigoInvitacion: form.codigoInvitacion.trim(),
      });
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  if (exito) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-700 flex items-center justify-center shadow-lg mb-4">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">¡Registro exitoso!</h1>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Tu cuenta fue creada. Un administrador activará tu acceso pronto. Te notificaremos por email.
        </p>
        <Button onClick={() => router.push("/login")} className="bg-emerald-700 hover:bg-emerald-800">
          Ir al inicio de sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center">
              <HeartPulse className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">Salud en Código</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta</h1>
        <p className="text-sm text-gray-500 mb-6">Registro para profesionales de salud</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nombre completo *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={form.nombre} required minLength={3}
                placeholder="Dr. Juan Pérez"
                onChange={e => set("nombre", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="email" value={form.email} required
                placeholder="correo@ejemplo.com"
                onChange={e => set("email", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Especialidad */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Especialidad *</label>
            <div className="relative">
              <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={form.especialidad} required minLength={3}
                placeholder="Medicina General"
                onChange={e => set("especialidad", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Colegiatura (opcional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">N° Colegiatura (opcional)</label>
            <Input
              value={form.colegioMedico}
              placeholder="CMP-12345"
              onChange={e => set("colegioMedico", e.target.value)}
            />
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contraseña *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password" value={form.password} required minLength={8}
                placeholder="Mínimo 8 caracteres"
                onChange={e => set("password", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Confirmar contraseña *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password" value={form.confirmar} required
                placeholder="Repite tu contraseña"
                onChange={e => set("confirmar", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Código de invitación */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Código de invitación *</label>
            <Input
              value={form.codigoInvitacion} required
              placeholder="Código proporcionado por tu centro"
              onChange={e => set("codigoInvitacion", e.target.value)}
            />
            <p className="text-[11px] text-gray-400">Solicitado por el administrador de tu centro de salud</p>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-700 hover:bg-emerald-800 mt-2"
            disabled={loading}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Registrando...</>
              : "Crear cuenta"
            }
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-emerald-700 font-medium">
            Iniciar sesión
          </Link>
        </p>

        <p className="text-[10px] text-center text-gray-400 mt-8">
          Salud en Código · Datos protegidos Ley 29733
        </p>
      </div>
    </div>
  );
}
