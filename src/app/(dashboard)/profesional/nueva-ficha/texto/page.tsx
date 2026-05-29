"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  FileText,
  AlertCircle,
  ChevronRight,
  User,
  Upload,
  FileImage,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SimplificarResponse } from "@/app/api/ai/simplificar/route";

type Estado = "escribir" | "procesando" | "resultado";
type EstadoOCR = "idle" | "subiendo";

const EJEMPLOS = [
  "DM2 descontrolada. HbA1c 9.2%. Se ajusta metformina 850mg c/12h + glibenclamida 5mg c/8h. Dieta hipocalorica estricta. Control en 4 semanas.",
  "HTA esencial. PA 160/95. Se indica enalapril 10mg QD + amlodipino 5mg QD. Restriccion de sodio. Evitar AINES. Control en 2 semanas.",
  "IRA superior viral. Fiebre 38.2C, odinofagia, rinorrea hialina. Se indica paracetamol 500mg c/6h PRN. Reposo relativo, hidratacion. Control si no mejora en 72h.",
];

export default function TextoClinicoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pacienteId = searchParams.get("pacienteId") ?? "";
  const pacienteNombre = searchParams.get("nombre") ?? "Paciente";

  const [estado, setEstado] = useState<Estado>("escribir");
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<SimplificarResponse | null>(null);

  const [estadoOCR, setEstadoOCR] = useState<EstadoOCR>("idle");
  const [ocrInfo, setOcrInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── OCR: subir PDF o imagen ──────────────────────────────────────────────────

  async function subirArchivo(file: File) {
    setEstadoOCR("subiendo");
    setError("");
    setOcrInfo(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Error al procesar el archivo");
        return;
      }

      setTexto(data.texto);
      const fuente = data.fuente === "PDF"
        ? `PDF procesado (${data.paginas ?? 1} pag.)`
        : `Imagen procesada (confianza ${data.confianza ?? "?"}%)`;
      setOcrInfo(fuente);
    } catch {
      setError("Error de conexion al procesar el archivo");
    } finally {
      setEstadoOCR("idle");
    }
  }

  // ── Llamar a Claude ──────────────────────────────────────────────────────────

  async function procesarConIA() {
    if (texto.trim().length < 10) {
      setError("Escribe al menos 10 caracteres para procesar.");
      return;
    }
    setError("");
    setEstado("procesando");

    try {
      const res = await fetch("/api/ai/simplificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textoOriginal: texto,
          pacienteNombre,
          pacienteEdad: 0,
          condiciones: [],
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Error al procesar con IA");
        setEstado("escribir");
        return;
      }

      setResultado(data as SimplificarResponse);
      setEstado("resultado");
    } catch {
      setError("Error de conexion. Verifica tu conexion a internet.");
      setEstado("escribir");
    }
  }

  // ── Continuar a paso 3 ───────────────────────────────────────────────────────

  function continuar() {
    if (!resultado) return;
    sessionStorage.setItem(
      "nueva-ficha-resultado",
      JSON.stringify({ pacienteId, pacienteNombre, textoOriginal: texto, resultado })
    );
    router.push("/profesional/nueva-ficha/validar");
  }

  function volverAEditar() {
    setEstado("escribir");
    setResultado(null);
    setError("");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: Escribir texto
  // ════════════════════════════════════════════════════════════════════════════

  if (estado === "escribir" || estado === "procesando") {
    return (
      <div className="px-5 py-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Nueva Ficha</h1>
            <p className="text-xs text-gray-400">Paso 2 de 3 · Texto clinico</p>
          </div>
        </div>

        {/* Pasos */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1 flex-1 rounded-full ${n <= 2 ? "bg-emerald-600" : "bg-gray-100"}`} />
          ))}
        </div>

        {/* Paciente */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
          <User className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 font-medium">{pacienteNombre}</span>
        </div>

        {/* Boton OCR */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,image/bmp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) subirArchivo(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={estadoOCR === "subiendo" || estado === "procesando"}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-emerald-300 text-sm text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
          >
            {estadoOCR === "subiendo"
              ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" />Extrayendo texto del archivo...</>
              : <><Upload className="w-4 h-4 shrink-0" /><FileImage className="w-4 h-4 shrink-0 -ml-1" />Subir PDF o imagen para extraer texto (OCR)</>
            }
          </button>

          {ocrInfo && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {ocrInfo} - texto pre-cargado en el campo
            </div>
          )}
        </div>

        {/* Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Nota clinica (lenguaje tecnico)
          </label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Escribe el diagnostico, tratamiento e indicaciones tal como las anotarias en la historia clinica...\n\nEj: DM2 descontrolada. HbA1c 9.2%. Se ajusta metformina 850mg c/12h. Dieta hipocalorica."}
            rows={7}
            disabled={estado === "procesando"}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white disabled:opacity-60"
          />
          <p className="text-[11px] text-gray-400 text-right">{texto.length} caracteres</p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Ejemplos */}
        {texto.length === 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Ejemplos rapidos</p>
            {EJEMPLOS.map((ej, i) => (
              <button
                key={i}
                onClick={() => setTexto(ej)}
                className="w-full text-left px-3 py-2.5 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 transition leading-relaxed"
              >
                <FileText className="w-3 h-3 inline mr-1.5 opacity-60" />
                {ej.substring(0, 80)}...
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 py-4 bg-white/95 backdrop-blur border-t border-gray-100">
          <Button
            onClick={procesarConIA}
            className="w-full bg-emerald-700 hover:bg-emerald-800"
            disabled={texto.trim().length < 10 || estado === "procesando"}
          >
            {estado === "procesando"
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Claude esta simplificando...</>
              : <><Sparkles className="w-4 h-4 mr-2" />Simplificar con IA</>
            }
          </Button>
        </div>
        <div className="h-20" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: Resultado IA
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={volverAEditar} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Resultado IA</h1>
          <p className="text-xs text-gray-400">Paso 2 de 3 · Revisa antes de continuar</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1 flex-1 rounded-full ${n <= 2 ? "bg-emerald-600" : "bg-gray-100"}`} />
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
        <p className="text-xs text-emerald-800 leading-snug">
          Claude simplifico el texto. Revisa que sea correcto y continua para validarlo como profesional.
        </p>
      </div>

      {resultado && (
        <div className="space-y-3">
          <ResultCard emoji="🩺" titulo="Que tiene el paciente?" contenido={resultado.diagnostico} color="emerald" />
          <ResultCard emoji="💊" titulo="Medicamentos" contenido={resultado.tratamiento} color="teal" />
          <ResultCard emoji="📋" titulo="Que debe hacer?" contenido={resultado.indicaciones} color="blue" />
          <ResultCard emoji="⚠️" titulo="Signos de alarma" contenido={resultado.signosAlarma} color="red" />
          <ResultCard emoji="📅" titulo="Proximo control" contenido={resultado.proximoControl} color="purple" />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 py-4 bg-white/95 backdrop-blur border-t border-gray-100 space-y-2">
        <Button onClick={continuar} className="w-full bg-emerald-700 hover:bg-emerald-800">
          Continuar a validar y generar QR
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        <Button variant="outline" className="w-full" onClick={volverAEditar}>
          Editar texto clinico
        </Button>
      </div>
      <div className="h-28" />
    </div>
  );
}

type Color = "emerald" | "teal" | "blue" | "red" | "purple";

const colorMap: Record<Color, { bg: string; border: string; badge: string }> = {
  emerald: { bg: "bg-emerald-50/60", border: "border-emerald-100", badge: "bg-emerald-100 text-emerald-800" },
  teal:    { bg: "bg-teal-50/60",    border: "border-teal-100",    badge: "bg-teal-100 text-teal-800" },
  blue:    { bg: "bg-blue-50/60",    border: "border-blue-100",    badge: "bg-blue-100 text-blue-800" },
  red:     { bg: "bg-red-50/60",     border: "border-red-100",     badge: "bg-red-100 text-red-800" },
  purple:  { bg: "bg-purple-50/60",  border: "border-purple-100",  badge: "bg-purple-100 text-purple-800" },
};

function ResultCard({ emoji, titulo, contenido, color }: { emoji: string; titulo: string; contenido: string; color: Color }) {
  const c = colorMap[color];
  return (
    <Card className={`${c.border} ${c.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
            {emoji} {titulo}
          </span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{contenido}</p>
      </CardContent>
    </Card>
  );
}
