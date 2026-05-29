"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText, Loader2, AlertCircle, QrCode,
  ShieldCheck, ShieldX, ChevronRight, HeartPulse
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Ficha {
  id: string;
  version: number;
  estado: string;
  diagnostico: string | null;
  createdAt: string;
  validadaEn: string | null;
  accesoQR: { tokenOpaco: string; revocado: boolean; totalAccesos: number } | null;
  profesional: { especialidad: string; centroSalud: { nombre: string } };
}

interface MisFichasResult {
  paciente: { nombre: string; dni: string; edad: number };
  fichas: Ficha[];
}

async function trpcQuery<T>(path: string): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

export default function PacienteHistorialPage() {
  const [resultado, setResultado] = useState<MisFichasResult | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    trpcQuery<MisFichasResult>("pacienteAuth.misFichas")
      .then(setResultado)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-5 py-5 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Mis fichas</h1>
        {resultado && (
          <p className="text-xs text-gray-400">
            {resultado.paciente.nombre} · DNI {resultado.paciente.dni}
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {resultado?.fichas.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Sin fichas disponibles</p>
          <p className="text-xs mt-1">Tu doctor aun no ha generado ninguna ficha activa</p>
        </div>
      ) : (
        <div className="space-y-3 pb-6">
          {resultado?.fichas.map((f) => (
            <Card key={f.id} className="border-gray-100">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-emerald-700 font-semibold">
                      {f.profesional.especialidad}
                    </p>
                    <p className="text-xs text-gray-400">{f.profesional.centroSalud.nombre}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    f.estado === "ACTIVA"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {f.estado === "ACTIVA"
                      ? <><ShieldCheck className="w-3 h-3" />Activa</>
                      : <><ShieldX className="w-3 h-3" />Revocada</>
                    }
                  </span>
                </div>

                {f.diagnostico && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed line-clamp-2">
                    {f.diagnostico}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-400">
                    {f.validadaEn
                      ? new Date(f.validadaEn).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
                      : new Date(f.createdAt).toLocaleDateString("es-PE")
                    }
                    {f.accesoQR && (
                      <span className="ml-2">
                        <QrCode className="w-3 h-3 inline mr-0.5" />
                        {f.accesoQR.totalAccesos} vista{f.accesoQR.totalAccesos !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {f.accesoQR && !f.accesoQR.revocado && f.estado === "ACTIVA" && (
                    <Link
                      href={`/ficha/${f.accesoQR.tokenOpaco}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition"
                    >
                      Ver ficha
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-gray-100 bg-gray-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <HeartPulse className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">
            Solo se muestran fichas activas y revocadas. Las fichas en borrador son visibles solo para tu doctor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
