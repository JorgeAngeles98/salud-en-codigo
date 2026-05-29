"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { HeartPulse, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // NextAuth maneja el redirect completo server-side
    // Si es exitoso → redirige a /profesional
    // Si falla → redirige a /login?error=CredentialsSignin
    signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      callbackUrl: "/profesional",
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-700 flex items-center justify-center shadow-lg mb-4">
          <HeartPulse className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Salud en Código</h1>
        <p className="text-sm text-gray-500 mt-1">Tu información clínica, siempre contigo</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {errorParam && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Email o contraseña incorrectos.
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
              autoCapitalize="none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>
        </div>

        <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={loading}>
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Ingresando...</>
            : "Ingresar"
          }
        </Button>
      </form>

      <div className="mt-8 text-center space-y-1">
        <p className="text-[11px] text-gray-400">ODS 3 · Salud y Bienestar</p>
        <p className="text-[11px] text-gray-400">Datos protegidos bajo la Ley 29733</p>
        <p className="text-[11px] text-gray-400 mt-2">
          ¿Eres paciente?{" "}
          <Link href="/paciente-login" className="text-emerald-600 font-medium">Accede aquí</Link>
        </p>
      </div>
    </div>
  );
}
