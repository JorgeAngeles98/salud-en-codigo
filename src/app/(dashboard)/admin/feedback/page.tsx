"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, MessageSquare, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Feedback {
  id: string; comprension: number; confianza: number;
  disposicionPago: string | null; comentario: string | null; createdAt: string;
  ficha: {
    diagnostico: string | null;
    paciente: { nombre: string };
    profesional: { especialidad: string; user: { name: string | null } };
  };
}

const PAGO_LABEL: Record<string, string> = {
  CENTRO_SALUD: "Centro paga", PAGO_COMPARTIDO: "Pago compartido",
  SOLO_PACIENTE: "Solo paciente", NO_PAGARIA: "No pagaría",
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} className={`w-3 h-3 ${i <= value ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
      ))}
    </div>
  );
}

async function trpcQuery<T>(path: string, input?: object): Promise<T> {
  const url = input
    ? `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `/api/trpc/${path}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [soloComentarios, setSoloComentarios] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async (sc: boolean) => {
    setCargando(true); setError("");
    try {
      const result = await trpcQuery<{ feedbacks: Feedback[] }>("admin.listFeedback", { soloConComentario: sc, limit: 40 });
      setFeedbacks(result?.feedbacks ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(false); }, [cargar]);

  const promComprension = feedbacks.length ? (feedbacks.reduce((a, f) => a + f.comprension, 0) / feedbacks.length).toFixed(1) : "-";
  const promConfianza = feedbacks.length ? (feedbacks.reduce((a, f) => a + f.confianza, 0) / feedbacks.length).toFixed(1) : "-";
  const conComentario = feedbacks.filter((f) => f.comentario).length;

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Feedback de Pacientes</h1>
        <p className="text-xs text-gray-400">{cargando ? "Cargando..." : `${feedbacks.length} respuestas`}</p>
      </div>

      {!cargando && feedbacks.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-amber-700">{promComprension}</p>
            <p className="text-[10px] text-amber-600">Comprensión</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{promConfianza}</p>
            <p className="text-[10px] text-blue-600">Confianza</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{conComentario}</p>
            <p className="text-[10px] text-emerald-600">Con comentario</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {[false, true].map((sc) => (
          <button key={String(sc)} onClick={() => { setSoloComentarios(sc); cargar(sc); }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${soloComentarios === sc ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {sc ? "Solo con comentarios" : "Todos"}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      {cargando ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-14 text-gray-400"><MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-200" /><p className="text-sm">Sin feedback aún</p></div>
      ) : (
        <div className="space-y-2 pb-6">
          {feedbacks.map((fb) => (
            <Card key={fb.id} className="border-gray-100">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{fb.ficha.paciente.nombre}</p>
                    <p className="text-xs text-gray-400">{fb.ficha.profesional.user.name} · {fb.ficha.profesional.especialidad}</p>
                  </div>
                  <p className="text-[10px] text-gray-300">{new Date(fb.createdAt).toLocaleDateString("es-PE")}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Comprensión</p>
                    <Stars value={fb.comprension} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Confianza</p>
                    <Stars value={fb.confianza} />
                  </div>
                  {fb.disposicionPago && (
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">Pago</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {PAGO_LABEL[fb.disposicionPago] ?? fb.disposicionPago}
                      </span>
                    </div>
                  )}
                </div>
                {fb.comentario && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-600 italic">"{fb.comentario}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
