"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  QrCode,
  Copy,
  Check,
  Home,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SimplificarResponse } from "@/app/api/ai/simplificar/route";

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface DatosNuevaFicha {
  pacienteId: string;
  pacienteNombre: string;
  textoOriginal: string;
  resultado: SimplificarResponse;
}

interface QrData {
  token: string;
  pin: string;
  url: string;
}

type Estado = "revisar" | "validando" | "listo" | "error-sesion";

// ── Campos editables ───────────────────────────────────────────────────────────

const CAMPOS: { key: keyof SimplificarResponse; label: string; emoji: string; requerido: boolean }[] = [
  { key: "diagnostico",    label: "¿Qué tiene el paciente?", emoji: "🩺", requerido: true },
  { key: "tratamiento",    label: "Medicamentos",            emoji: "💊", requerido: true },
  { key: "indicaciones",   label: "¿Qué debe hacer?",       emoji: "📋", requerido: true },
  { key: "signosAlarma",   label: "Signos de alarma",       emoji: "⚠️", requerido: true },
  { key: "proximoControl", label: "Próximo control",        emoji: "📅", requerido: false },
];

// ── Helpers tRPC ───────────────────────────────────────────────────────────────

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

// ── Página ─────────────────────────────────────────────────────────────────────

export default function ValidarFichaPage() {
  const router = useRouter();

  const [estado, setEstado] = useState<Estado>("revisar");
  const [datos, setDatos] = useState<DatosNuevaFicha | null>(null);
  const [campos, setCampos] = useState<SimplificarResponse | null>(null);
  const [campoEditando, setCampoEditando] = useState<keyof SimplificarResponse | null>(null);
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const [pinCopiado, setPinCopiado] = useState(false);
  const [urlCopiada, setUrlCopiada] = useState(false);

  // ── Cargar datos desde sessionStorage ───────────────────────────────────────

  useEffect(() => {
    const raw = sessionStorage.getItem("nueva-ficha-resultado");
    if (!raw) {
      setEstado("error-sesion");
      return;
    }
    try {
      const parsed: DatosNuevaFicha = JSON.parse(raw);
      setDatos(parsed);
      setCampos({ ...parsed.resultado });
    } catch {
      setEstado("error-sesion");
    }
  }, []);

  // ── Validar y generar QR ─────────────────────────────────────────────────────

  async function validarFicha() {
    if (!datos || !campos) return;
    setError("");
    setEstado("validando");

    try {
      // 1. Crear la ficha en BORRADOR
      const fichaCreada = await trpcMutation<{ id: string }>(
        "ficha.create",
        {
          pacienteId: datos.pacienteId,
          textoOriginal: datos.textoOriginal,
          fuenteDatos: "TEXTO",
        }
      );

      // 2. Validar la ficha (profesional aprueba y genera QR)
      const validada = await trpcMutation<{
        ficha: { id: string };
        qr: QrData;
      }>("ficha.validate", {
        fichaId: fichaCreada.id,
        diagnostico:    campos.diagnostico,
        tratamiento:    campos.tratamiento,
        indicaciones:   campos.indicaciones,
        signosAlarma:   campos.signosAlarma,
        proximoControl: campos.proximoControl ?? "",
      });

      // 3. Generar imagen QR (client-side con qrcode)
      // Usar window.location.origin para que funcione desde celular en red local
      const qrUrl = `${window.location.origin}/ficha/${validada.qr.token}`;
      const qrFinal = { ...validada.qr, url: qrUrl };

      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#1a1a1a", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });

      setQrData(qrFinal);
      setQrImageUrl(dataUrl);
      setEstado("listo");

      // Limpiar sessionStorage
      sessionStorage.removeItem("nueva-ficha-resultado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al validar la ficha");
      setEstado("revisar");
    }
  }

  // ── Copiar al portapapeles ───────────────────────────────────────────────────

  async function copiarPin() {
    if (!qrData) return;
    await navigator.clipboard.writeText(qrData.pin);
    setPinCopiado(true);
    setTimeout(() => setPinCopiado(false), 2000);
  }

  async function copiarUrl() {
    if (!qrData) return;
    await navigator.clipboard.writeText(qrData.url);
    setUrlCopiada(true);
    setTimeout(() => setUrlCopiada(false), 2000);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: Error de sesión
  // ════════════════════════════════════════════════════════════════════════════

  if (estado === "error-sesion") {
    return (
      <div className="px-5 py-10 flex flex-col items-center text-center gap-4">
        <AlertCircle className="w-10 h-10 text-orange-400" />
        <div>
          <p className="font-semibold text-gray-800">Sesión expirada</p>
          <p className="text-sm text-gray-500 mt-1">
            Los datos de la ficha no se encontraron. Por favor empieza de nuevo.
          </p>
        </div>
        <Button onClick={() => router.push("/profesional/nueva-ficha")}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: QR listo — pantalla de éxito
  // ════════════════════════════════════════════════════════════════════════════

  if (estado === "listo" && qrData) {
    return (
      <div className="px-5 py-5 space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl bg-emerald-700 flex items-center justify-center mx-auto shadow-lg">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-3">
            ¡Ficha validada!
          </h1>
          <p className="text-sm text-gray-500">
            {datos?.pacienteNombre} ya puede acceder a su ficha
          </p>
        </div>

        {/* QR Code */}
        <Card className="border-emerald-100 overflow-hidden">
          <CardContent className="p-5 flex flex-col items-center gap-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Código QR del paciente
            </p>
            {qrImageUrl ? (
              <img
                src={qrImageUrl}
                alt="QR Ficha Clínica"
                className="w-52 h-52 rounded-xl border border-gray-100"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            )}

            {/* PIN */}
            <div className="w-full bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
              <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mb-1">
                PIN del paciente
              </p>
              <p className="text-4xl font-mono font-bold text-emerald-900 tracking-[0.4em]">
                {qrData.pin}
              </p>
              <button
                onClick={copiarPin}
                className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 transition"
              >
                {pinCopiado ? (
                  <><Check className="w-3 h-3" /> Copiado</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copiar PIN</>
                )}
              </button>
            </div>

            {/* URL directa */}
            <div className="w-full">
              <p className="text-[10px] text-gray-400 text-center mb-1">
                URL directa de la ficha
              </p>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-600 flex-1 truncate font-mono">
                  {qrData.url}
                </p>
                <button onClick={copiarUrl} className="shrink-0">
                  {urlCopiada ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instrucciones */}
        <Card className="border-gray-100 bg-gray-50/60">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-600">
              📋 Instrucciones para el paciente
            </p>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Muéstrale el código QR o comparte la URL directa</li>
              <li>Dile su PIN de 4 dígitos: <strong className="text-gray-700">{qrData.pin}</strong></li>
              <li>El paciente ingresa el PIN para ver su ficha simplificada</li>
            </ol>
          </CardContent>
        </Card>

        {/* Acciones */}
        <div className="space-y-2 pb-6">
          <Button
            className="w-full bg-emerald-700 hover:bg-emerald-800"
            onClick={() => router.push("/profesional/nueva-ficha")}
          >
            <QrCode className="w-4 h-4 mr-2" />
            Crear otra ficha
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/profesional")}
          >
            <Home className="w-4 h-4 mr-2" />
            Ir al inicio
          </Button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: Revisar y editar campos
  // ════════════════════════════════════════════════════════════════════════════

  if (!campos) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-5 py-5 space-y-4">
      {/* Sub-header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Validar Ficha</h1>
          <p className="text-xs text-gray-400">
            Paso 3 de 3 · Revisa, edita y valida como profesional
          </p>
        </div>
      </div>

      {/* Indicador de pasos */}
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-1 flex-1 rounded-full bg-emerald-600" />
        ))}
      </div>

      {/* Paciente */}
      {datos && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm text-gray-700 font-medium">
            {datos.pacienteNombre}
          </span>
          <span className="text-xs text-gray-400 ml-auto">
            Validación profesional requerida
          </span>
        </div>
      )}

      {/* Aviso */}
      <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 leading-relaxed">
        <strong>Revisa cada campo.</strong> Puedes editar el texto tocando el
        ícono ✏️. Al validar, se genera el QR y el paciente podrá acceder a su
        ficha.
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Campos editables */}
      <div className="space-y-3">
        {CAMPOS.map(({ key, label, emoji, requerido }) => (
          <Card key={key} className="border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-500">
                  {emoji} {label}
                  {requerido && <span className="text-red-400 ml-0.5">*</span>}
                </span>
                <button
                  onClick={() =>
                    setCampoEditando(campoEditando === key ? null : key)
                  }
                  className="text-gray-300 hover:text-emerald-600 transition shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              {campoEditando === key ? (
                <div className="space-y-2">
                  <textarea
                    value={campos[key] ?? ""}
                    onChange={(e) =>
                      setCampos((prev) =>
                        prev ? { ...prev, [key]: e.target.value } : prev
                      )
                    }
                    rows={4}
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => setCampoEditando(null)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Listo
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">
                  {campos[key] || (
                    <span className="text-gray-300 italic">Sin contenido</span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer fijo: fondo blanco hasta el borde inferior y boton elevado
          con pb para quedar pegado sobre la barra de navegacion */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto px-5 pt-4 pb-20 bg-white border-t border-gray-100">
        <Button
          onClick={validarFicha}
          className="w-full bg-emerald-700 hover:bg-emerald-800"
          disabled={
            estado === "validando" ||
            !campos.diagnostico ||
            !campos.tratamiento ||
            !campos.indicaciones ||
            !campos.signosAlarma
          }
        >
          {estado === "validando" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Generando ficha y QR...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Validar y generar QR
            </>
          )}
        </Button>
      </div>
      <div className="h-36" />
    </div>
  );
}
