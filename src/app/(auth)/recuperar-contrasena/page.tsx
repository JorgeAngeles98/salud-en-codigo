"use client";

import { useState } from "react";
import { HeartPulse, Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
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

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await trpcMutation("auth.forgotPassword", { email: email.trim().toLowerCase() });
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el correo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative">
      <div className="absolute top-5 left-6">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft className="w-4 h-4" /> Volver al login
        </Link>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-700 flex items-center justify-center shadow-lg mb-4">
          <HeartPulse className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>
        <p className="text-sm text-gray-500 mt-1 text-center max-w-xs">
          Ingresa tu email y te enviaremos un enlace para restablecerla.
        </p>
      </div>

      {enviado ? (
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <p className="text-gray-700 font-medium">¡Revisa tu correo!</p>
          <p className="text-sm text-gray-500">
            Si existe una cuenta con ese email, recibirás el enlace en los próximos minutos.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full mt-2">Volver al login</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="email"
                placeholder="doctor@centrosalud.gob.pe"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={loading}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</>
              : "Enviar enlace de recuperación"
            }
          </Button>
        </form>
      )}
    </div>
  );
}
