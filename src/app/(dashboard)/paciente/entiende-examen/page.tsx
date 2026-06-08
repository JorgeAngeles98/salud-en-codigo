"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileImage,
  Loader2,
  AlertTriangle,
  Sparkles,
  FileSearch,
  Stethoscope,
  ClipboardList,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface OrientacionResponse {
  resumen: string;
  puntosClave: string;
  sugerencia: string;
}

type Estado = "inicio" | "procesando" | "resultado";

export default function EntiendeExamenPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("inicio");
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<OrientacionResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function ocrImagen(file: File): Promise<string> {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa");
    try {
      setProgreso("Leyendo la imagen...");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);
      preprocesarParaOcr(ctx, canvas.width, canvas.height);
      const { data } = await worker.recognize(canvas);
      return data.text.trim();
    } finally {
      await worker.terminate();
    }
  }

  async function ocrPdf(file: File): Promise<string> {
    const pdfjs = await import("pdfjs-dist");
    // Worker desde CDN con la version exacta instalada (robusto en produccion)
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const { createWorker } = await import("tesseract.js");

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const total = pdf.numPages;
    const worker = await createWorker("spa");
    let texto = "";
    try {
      for (let n = 1; n <= total; n++) {
        setProgreso(`Leyendo pagina ${n} de ${total}...`);
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 3 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        preprocesarParaOcr(ctx, canvas.width, canvas.height);
        const { data } = await worker.recognize(canvas);
        texto += data.text.trim() + "\n\n";
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      await worker.terminate();
    }
    return texto.trim();
  }

  async function procesar(file: File) {
    setEstado("procesando");
    setError("");
    setResultado(null);
    setProgreso("Preparando...");

    try {
      const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const texto = esPdf ? await ocrPdf(file) : await ocrImagen(file);

      if (!texto || texto.length < 10) {
        setError("No se pudo leer el documento. Asegurate de que la foto o el escaneo sea claro.");
        setEstado("inicio");
        return;
      }

      setProgreso("Analizando con IA...");
      const res = await fetch("/api/ai/orientacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textodocumento: texto }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Error al analizar el documento");
        setEstado("inicio");
        return;
      }

      setResultado(data as OrientacionResponse);
      setEstado("resultado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar el documento");
      setEstado("inicio");
    } finally {
      setProgreso("");
    }
  }

  function reiniciar() {
    setEstado("inicio");
    setResultado(null);
    setError("");
  }

  return (
    <div className="px-5 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/paciente")}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Entiende tu examen</h1>
          <p className="text-xs text-gray-400">Orientacion sencilla, no es un diagnostico</p>
        </div>
      </div>

      {/* Disclaimer siempre visible */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Esto es solo una <strong>orientacion</strong> para ayudarte a entender tu documento.
          <strong> No es un diagnostico medico.</strong> Lleva siempre tu examen a un profesional de salud para que lo interprete.
        </span>
      </div>

      {/* INICIO: subir documento */}
      {estado === "inicio" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,image/bmp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) procesar(file);
              e.target.value = "";
            }}
          />
          <Card className="border-dashed border-2 border-emerald-200">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <FileSearch className="w-7 h-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Sube tu examen o receta</p>
                <p className="text-xs text-gray-500 mt-1">
                  Una foto o PDF de tu documento. Lo leemos en tu telefono, sin enviar el archivo a ningun lado.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 text-sm text-white hover:bg-emerald-800 transition"
              >
                <Upload className="w-4 h-4" />
                <FileImage className="w-4 h-4 -ml-1" />
                Subir foto o PDF
              </button>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </>
      )}

      {/* PROCESANDO */}
      {estado === "procesando" && (
        <Card className="border-emerald-100">
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-gray-700">{progreso || "Procesando..."}</p>
            <p className="text-xs text-gray-400">
              La primera vez puede tardar un poco mientras se prepara el lector.
            </p>
          </CardContent>
        </Card>
      )}

      {/* RESULTADO */}
      {estado === "resultado" && resultado && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-800 leading-snug">
              Esto es lo que entendimos de tu documento, en lenguaje sencillo.
            </p>
          </div>

          <ResultCard icon={<FileSearch className="w-4 h-4" />} titulo="Que dice tu documento" texto={resultado.resumen} />
          <ResultCard icon={<ClipboardList className="w-4 h-4" />} titulo="Puntos importantes" texto={resultado.puntosClave} />
          <ResultCard icon={<Stethoscope className="w-4 h-4" />} titulo="Que hacer" texto={resultado.sugerencia} resaltado />

          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Recuerda: esto NO reemplaza a tu medico. Solo un profesional puede darte un diagnostico y un tratamiento.
            </span>
          </div>

          <Button onClick={reiniciar} variant="outline" className="w-full">
            <RotateCcw className="w-4 h-4 mr-2" />
            Consultar otro documento
          </Button>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}

// Mejora la imagen antes del OCR: escala de grises + aumento de contraste.
function preprocesarParaOcr(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const contraste = 1.6;
  const intercepto = 128 * (1 - contraste);
  for (let i = 0; i < d.length; i += 4) {
    let gris = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gris = gris * contraste + intercepto;
    gris = gris < 0 ? 0 : gris > 255 ? 255 : gris;
    d[i] = d[i + 1] = d[i + 2] = gris;
  }
  ctx.putImageData(imageData, 0, 0);
}

function ResultCard({
  icon,
  titulo,
  texto,
  resaltado,
}: {
  icon: React.ReactNode;
  titulo: string;
  texto: string;
  resaltado?: boolean;
}) {
  return (
    <Card className={resaltado ? "border-emerald-200 bg-emerald-50/40" : "border-gray-100"}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2 text-emerald-700">
          {icon}
          <span className="text-sm font-semibold">{titulo}</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{texto}</p>
      </CardContent>
    </Card>
  );
}
