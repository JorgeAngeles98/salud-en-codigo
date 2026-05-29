"use client";

import { useState } from "react";
import {
  HeartPulse,
  Stethoscope,
  Pill,
  AlertTriangle,
  Calendar,
  Volume2,
  Lock,
  Loader2,
  ThumbsUp,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useParams } from "next/navigation";

interface FichaData {
  fichaId: string;
  paciente: { nombre: string; edad: number; condiciones: string[] };
  profesional: { especialidad: string; centroSalud: { nombre: string } };
  diagnostico: string | null;
  tratamiento: string | null;
  indicaciones: string | null;
  signosAlarma: string | null;
  proximoControl: string | null;
  validadaEn: string | null;
  version: number;
}

type FeedbackEstado = "idle" | "abierto" | "enviando" | "enviado";

export default function FichaPublicaPage() {
  const params = useParams<{ token: string }>();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ficha, setFicha] = useState<FichaData | null>(null);

  const [feedbackEstado, setFeedbackEstado] = useState<FeedbackEstado>("idle");
  const [comprension, setComprension] = useState(0);
  const [confianza, setConfianza] = useState(0);
  const [comentario, setComentario] = useState("");
  const [feedbackError, setFeedbackError] = useState("");

  async function handleAccess(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/trpc/ficha.accessByToken?input=${encodeURIComponent(
          JSON.stringify({ json: { token: params.token, pin } })
        )}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error.message || "PIN incorrecto");
      } else {
        setFicha(data.result?.data?.json ?? data.result?.data);
      }
    } catch {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  }

  async function enviarFeedback() {
    if (!ficha || comprension === 0 || confianza === 0) {
      setFeedbackError("Por favor responde todas las preguntas con estrellitas.");
      return;
    }
    setFeedbackError("");
    setFeedbackEstado("enviando");
    try {
      const res = await fetch("/api/trpc/feedback.submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            fichaId: ficha.fichaId,
            comprension,
            confianza,
            comentario: comentario.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.error) {
        setFeedbackError(data.error.message || "Error al enviar");
        setFeedbackEstado("abierto");
      } else {
        setFeedbackEstado("enviado");
      }
    } catch {
      setFeedbackError("Error de conexion");
      setFeedbackEstado("abierto");
    }
  }

  function speak(text: string) {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-PE";
      utterance.rate = 0.85;
      speechSynthesis.speak(utterance);
    }
  }

  if (!ficha) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-emerald-700 flex items-center justify-center shadow-lg mb-4">
          <HeartPulse className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Tu Ficha Clinica</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Ingresa el PIN de 4 digitos que te dio tu profesional de salud
        </p>
        <form onSubmit={handleAccess} className="w-full max-w-xs space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
              {error}
            </div>
          )}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="* * * *"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="pl-10 text-center text-2xl tracking-[0.5em] font-mono"
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || pin.length !== 4}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Verificando...</>
              : "Ver mi ficha"
            }
          </Button>
        </form>
        <p className="text-[10px] text-gray-400 mt-8 text-center">
          Salud en Codigo - Datos protegidos Ley 29733
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="bg-emerald-700 text-white px-5 py-5 rounded-b-3xl shadow-lg">
        <p className="text-[10px] uppercase tracking-wider opacity-80">Paciente</p>
        <p className="text-xl font-bold">{ficha.paciente.nombre}</p>
        <p className="text-xs opacity-90">
          {ficha.paciente.edad} años - {ficha.profesional.centroSalud.nombre}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] opacity-80">
            v{ficha.version} - Validada{" "}
            {ficha.validadaEn
              ? new Date(ficha.validadaEn).toLocaleDateString("es-PE")
              : ""}
          </span>
          <button
            onClick={() =>
              speak(
                `${ficha.diagnostico}. ${ficha.tratamiento}. ${ficha.indicaciones}. Signos de alarma: ${ficha.signosAlarma}`
              )
            }
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 text-[11px]"
          >
            <Volume2 className="w-3 h-3" /> Escuchar
          </button>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        <Section icon={Stethoscope} title="Que tienes?" tint="emerald">
          <p>{ficha.diagnostico}</p>
        </Section>
        <Section icon={Pill} title="Tus medicamentos" tint="teal">
          <p>{ficha.tratamiento}</p>
        </Section>
        <Section icon={HeartPulse} title="Que debes hacer?" tint="emerald">
          <p>{ficha.indicaciones}</p>
        </Section>
        <Section icon={AlertTriangle} title="Signos de alarma" tint="red">
          <p className="font-medium">Ve a emergencia si tienes:</p>
          <p className="mt-1">{ficha.signosAlarma}</p>
        </Section>
        {ficha.proximoControl && (
          <Section icon={Calendar} title="Proximo control" tint="teal">
            <p className="font-medium">{ficha.proximoControl}</p>
          </Section>
        )}

        {feedbackEstado === "enviado" ? (
          <Card className="border-emerald-100 bg-emerald-50/60">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Gracias por tu respuesta!</p>
                <p className="text-xs text-emerald-700">Tu opinion nos ayuda a mejorar.</p>
              </div>
            </CardContent>
          </Card>
        ) : feedbackEstado === "abierto" || feedbackEstado === "enviando" ? (
          <Card className="border-emerald-100">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Entendiste tu ficha?</p>
                <button onClick={() => setFeedbackEstado("idle")}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">Entendiste tu diagnostico e indicaciones?</p>
                <StarRating value={comprension} onChange={setComprension} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">Confias en la informacion que recibiste?</p>
                <StarRating value={confianza} onChange={setConfianza} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">Algo mas que quieras decirnos? (opcional)</p>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Escribe aqui tu comentario..."
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {feedbackError && (
                <p className="text-xs text-red-600">{feedbackError}</p>
              )}
              <Button
                className="w-full bg-emerald-700 hover:bg-emerald-800"
                onClick={enviarFeedback}
                disabled={feedbackEstado === "enviando"}
              >
                {feedbackEstado === "enviando"
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</>
                  : "Enviar respuesta"
                }
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <ThumbsUp className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Entendiste tu ficha?</p>
                <p className="text-xs text-gray-500">Cuentanos en 1 minuto</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setFeedbackEstado("abierto")}>
                Responder
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-[10px] text-center text-gray-400">
          Informacion validada por {ficha.profesional.especialidad} - {ficha.profesional.centroSalud.nombre}
        </p>
      </div>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-2xl transition-transform active:scale-110 ${n <= value ? "opacity-100" : "opacity-25"}`}
        >
          &#11088;
        </button>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  tint,
  children,
}: {
  icon: typeof Pill;
  title: string;
  tint: "emerald" | "teal" | "red";
  children: React.ReactNode;
}) {
  const colors = { emerald: "bg-emerald-50 text-emerald-700", teal: "bg-teal-50 text-teal-700", red: "bg-red-50 text-red-600" };
  const borders = { emerald: "border-gray-100", teal: "border-gray-100", red: "border-red-100" };
  return (
    <Card className={borders[tint]}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[tint]}`}>
            <Icon className="w-4 h-4" />
          </span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <div className="text-sm leading-relaxed text-gray-700">{children}</div>
      </CardContent>
    </Card>
  );
}
