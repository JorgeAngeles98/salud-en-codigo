"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, ArrowLeft, Link as LinkIcon, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function IngresarQRPage() {
  const router = useRouter();
  const [enlace, setEnlace] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const valor = enlace.trim();

      // Si es una URL completa, extraer el token
      let token = valor;
      if (valor.includes("/ficha/")) {
        token = valor.split("/ficha/")[1].split("?")[0].split("#")[0];
      }

      if (!token) {
        setError("Ingresa un enlace o token válido.");
        setLoading(false);
        return;
      }

      // Redirigir a la página pública de la ficha
      router.push(`/ficha/${token}`);
    } catch {
      setError("El enlace no es válido. Verifica e intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/paciente"
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Ingresar QR</h1>
          <p className="text-xs text-gray-400">Accede a tu ficha médica</p>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="bg-teal-50 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
          <QrCode className="w-5 h-5 text-teal-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-teal-800 mb-1">¿Cómo funciona?</p>
          <ol className="text-xs text-teal-700 space-y-1 list-decimal list-inside">
            <li>Tu doctor te compartió un enlace o código QR</li>
            <li>Si escaneaste el QR, ya deberías estar viendo tu ficha</li>
            <li>Si te dieron solo el enlace, pégalo aquí abajo</li>
          </ol>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Enlace o token de tu ficha
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="https://... o el token que te dio tu doctor"
              className="pl-10"
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Pega el enlace completo o solo el código alfanumérico
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-teal-600 hover:bg-teal-700"
          disabled={loading || !enlace.trim()}
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Abriendo ficha...</>
            : "Ver mi ficha"
          }
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-100" />
        <p className="text-xs text-gray-400">o</p>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      {/* Info escaneo */}
      <div className="bg-gray-50 rounded-2xl p-4 text-center">
        <QrCode className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-600">¿Tienes el código QR impreso?</p>
        <p className="text-xs text-gray-400 mt-1">
          Ábrelo con la cámara de tu celular directamente — no necesitas esta página
        </p>
      </div>
    </div>
  );
}
