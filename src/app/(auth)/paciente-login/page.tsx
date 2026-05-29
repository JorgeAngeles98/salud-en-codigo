"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { HeartPulse, Loader2, AlertCircle, Calendar, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Modo = "login" | "registro";

export default function PacienteLoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("login");
  const [dni, setDni] = useState("");
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setExito("");
    setLoading(true);
    try {
      const res = await signIn("paciente", { dni, fechaNacimiento: fecha, redirect: false });
      if (res?.error) {
        setError("DNI o fecha de nacimiento incorrectos. Verifica tus datos.");
      } else {
        router.push("/paciente");
      }
    } catch {
      setError("Error de conexion. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setExito("");
    setLoading(true);
    try {
      // 1. Buscar el paciente por DNI para obtener su centroSaludId
      const resBuscar = await fetch(
        `/api/trpc/pacienteAuth.buscarPaciente?input=${encodeURIComponent(JSON.stringify({ json: { dni } }))}`
      );
      const dataBuscar = await resBuscar.json();
      const info = dataBuscar?.result?.data?.json ?? dataBuscar?.result?.data;

      if (!info) {
        setError("No encontramos tu registro. Pide a tu doctor que te registre primero y que guarde tu fecha de nacimiento.");
        return;
      }
      if (info.tieneCuenta) {
        setError("Ya tienes cuenta creada. Usa la pestana Ingresar con tu DNI y fecha de nacimiento.");
        return;
      }

      // 2. Crear cuenta
      const resReg = await fetch("/api/trpc/pacienteAuth.register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { dni, fechaNacimiento: fecha, centroSaludId: info.centroSaludId } }),
      });
      const dataReg = await resReg.json();
      if (dataReg.error) {
        setError(dataReg.error.message ?? "Error al registrar");
        return;
      }

      // 3. Login automatico
      const loginRes = await signIn("paciente", { dni, fechaNacimiento: fecha, redirect: false });
      if (loginRes?.error) {
        setExito("Cuenta creada. Ahora puedes ingresar con tu DNI y fecha de nacimiento.");
        setModo("login");
      } else {
        router.push("/paciente");
      }
    } catch {
      setError("Error de conexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-gradient-to-b from-emerald-50 to-white">
      <div className="w-16 h-16 rounded-2xl bg-emerald-700 flex items-center justify-center shadow-lg mb-4">
        <HeartPulse className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Mi Salud en Codigo</h1>
      <p className="text-sm text-gray-500 mb-6 text-center">
        Accede a tus fichas medicas de forma segura
      </p>

      <div className="w-full max-w-xs">
        {/* Tabs */}
        <div className="flex rounded-xl border border-gray-200 p-1 mb-5 bg-gray-50">
          {(["login", "registro"] as Modo[]).map((m) => (
            <button
              key={m}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${modo === m ? "bg-white shadow text-emerald-700" : "text-gray-500"}`}
              onClick={() => { setModo(m); setError(""); setExito(""); }}
            >
              {m === "login" ? "Ingresar" : "Primera vez"}
            </button>
          ))}
        </div>

        <form onSubmit={modo === "login" ? handleLogin : handleRegistro} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {exito && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">
              {exito}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tu DNI</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="12345678"
                inputMode="numeric"
                maxLength={8}
                required
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Fecha de nacimiento
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="pl-10"
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              {modo === "login"
                ? "La misma fecha que usaste al crear tu cuenta"
                : "Esta fecha es tu clave de acceso — no se puede cambiar despues"
              }
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-700 hover:bg-emerald-800"
            disabled={loading || dni.length !== 8 || !fecha}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Verificando...</>
              : modo === "login" ? "Ver mis fichas" : "Crear mi cuenta"
            }
          </Button>
        </form>

        {modo === "registro" && !exito && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-xs text-amber-800 leading-relaxed">
              Para crear tu cuenta, tu doctor debe haberte registrado previamente y guardado tu fecha de nacimiento en el sistema.
            </p>
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-6 text-center">
          Salud en Codigo - Datos protegidos Ley 29733
        </p>
        <div className="mt-3 text-center">
          <a href="/login" className="text-xs text-gray-400 underline underline-offset-2">
            Soy profesional de salud
          </a>
        </div>
      </div>
    </div>
  );
}
