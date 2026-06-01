"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { HeartPulse, Lock, Loader2, AlertCircle, CheckCircle } from "lucide-react";
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

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [exitoso, setExitoso] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nuevaPassword !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await trpcMutation("auth.resetPassword", { token, nuevaPassword });
      setExitoso(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-700 font-medium">Enlace inválido</p>
        <p className="text-sm text-gray-500 mt-1">Este enlace no contiene un token válido.</p>
        <Link href="/recuperar-contrasena" className="mt-4 text-emerald-600 text-sm font-medium">
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-700 flex items-center justify-center shadow-lg mb-4">
          <HeartPulse className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva contraseña</h1>
        <p className="text-sm text-gray-500 mt-1">Elige una contraseña segura de al menos 8 caracteres.</p>
      </div>

      {exitoso ? (
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <p className="text-gray-700 font-medium">¡Contraseña actualizada!</p>
          <p className="text-sm text-gray-500">Redirigiendo al login...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nueva contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password"
                placeholder="••••••••"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                className="pl-10"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Confirmar contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="pl-10"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>

          <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={loading}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</>
              : "Restablecer contraseña"
            }
          </Button>

          <p className="text-center text-xs text-gray-400">
            ¿El enlace expiró?{" "}
            <Link href="/recuperar-contrasena" className="text-emerald-600 font-medium">
              Solicitar uno nuevo
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
