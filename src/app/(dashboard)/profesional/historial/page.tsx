"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, QrCode, Loader2, AlertCircle, ShieldCheck,
  ShieldX, Clock, RefreshCw, X, Copy, Check, RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Ficha {
  id: string;
  version: number;
  estado: "BORRADOR" | "VALIDADA" | "ACTIVA" | "REVOCADA";
  diagnostico: string | null;
  createdAt: string;
  paciente: { nombre: string; dni: string; edad: number };
  accesoQR: { totalAccesos: number; revocado: boolean } | null;
  _count: { feedback: number };
}

interface QrModal {
  fichaId: string;
  pacienteNombre: string;
  token: string;
  pin: string;
  url: string;
  qrImagen: string;
}

const ESTADO_CONFIG = {
  BORRADOR:  { label: "Borrador",  color: "bg-gray-100 text-gray-600",     icon: Clock },
  VALIDADA:  { label: "Validada",  color: "bg-blue-50 text-blue-700",      icon: ShieldCheck },
  ACTIVA:    { label: "Activa",    color: "bg-emerald-50 text-emerald-700", icon: ShieldCheck },
  REVOCADA:  { label: "Revocada",  color: "bg-red-50 text-red-600",        icon: ShieldX },
};

async function trpcQuery<T>(path: string, input?: object): Promise<T> {
  const url = input
    ? `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : `/api/trpc/${path}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Error");
  return (data.result?.data?.json ?? data.result?.data) as T;
}

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

export default function HistorialPage() {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [revocando, setRevocando] = useState<string | null>(null);
  const [generandoQR, setGenerandoQR] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<QrModal | null>(null);
  const [pinCopiado, setPinCopiado] = useState(false);
  const [urlCopiada, setUrlCopiada] = useState(false);

  const cargarFichas = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const result = await trpcQuery<Ficha[]>("ficha.list", { limit: 30 });
      setFichas(result ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar fichas");
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargarFichas(); }, [cargarFichas]);

  async function revocarQR(fichaId: string) {
    if (!confirm("¿Revocar el acceso QR? El paciente ya no podrá ver la ficha.")) return;
    setRevocando(fichaId);
    try {
      await trpcMutation("ficha.revokeQR", { fichaId });
      cargarFichas();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setRevocando(null); }
  }

  async function verQR(ficha: Ficha) {
    setGenerandoQR(ficha.id);
    try {
      const result = await trpcMutation<{ token: string; pin: string }>(
        "ficha.regenerarQR", { fichaId: ficha.id }
      );
      const url = `${window.location.origin}/ficha/${result.token}`;
      const QRCode = await import("qrcode");
      const qrImagen = await QRCode.toDataURL(url, {
        width: 260, margin: 2,
        color: { dark: "#1a1a1a", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      setQrModal({
        fichaId: ficha.id,
        pacienteNombre: ficha.paciente.nombre,
        token: result.token,
        pin: result.pin,
        url,
        qrImagen,
      });
    } catch (err) { alert(err instanceof Error ? err.message : "Error al generar QR"); }
    finally { setGenerandoQR(null); }
  }

  async function copiarPin() {
    if (!qrModal) return;
    await navigator.clipboard.writeText(qrModal.pin);
    setPinCopiado(true);
    setTimeout(() => setPinCopiado(false), 2000);
  }

  async function copiarUrl() {
    if (!qrModal) return;
    await navigator.clipboard.writeText(qrModal.url);
    setUrlCopiada(true);
    setTimeout(() => setUrlCopiada(false), 2000);
  }

  return (
    <>
      <div className="px-5 py-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Historial</h1>
            <p className="text-xs text-gray-400">
              {cargando ? "Cargando..." : `${fichas.length} ficha${fichas.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={cargarFichas} disabled={cargando}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${cargando ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
          </div>
        ) : fichas.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No hay fichas creadas aún</p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {fichas.map((f) => {
              const cfg = ESTADO_CONFIG[f.estado];
              const Icon = cfg.icon;
              const fecha = new Date(f.createdAt).toLocaleDateString("es-PE", {
                day: "numeric", month: "short", year: "numeric",
              });
              return (
                <Card key={f.id} className="border-gray-100">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{f.paciente.nombre}</p>
                        <p className="text-xs text-gray-400">DNI: {f.paciente.dni} · {f.paciente.edad} años · {fecha}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                    </div>

                    {f.diagnostico && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed line-clamp-2">
                        {f.diagnostico}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        {f.accesoQR && (
                          <span className="flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            {f.accesoQR.totalAccesos} acceso{f.accesoQR.totalAccesos !== 1 ? "s" : ""}
                          </span>
                        )}
                        {f._count.feedback > 0 && <span>👍 {f._count.feedback} feedback</span>}
                        <span className="text-gray-300">v{f.version}</span>
                      </div>

                      {f.estado === "ACTIVA" && (
                        <div className="flex items-center gap-1.5">
                          {/* Botón Ver / Regenerar QR */}
                          <Button
                            size="sm" variant="outline"
                            className="text-[11px] h-7 px-2.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1"
                            onClick={() => verQR(f)}
                            disabled={generandoQR === f.id}
                          >
                            {generandoQR === f.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><QrCode className="w-3 h-3" />Ver QR</>
                            }
                          </Button>
                          {/* Revocar */}
                          {f.accesoQR && !f.accesoQR.revocado && (
                            <Button
                              size="sm" variant="outline"
                              className="text-[11px] h-7 px-2 text-red-500 border-red-100 hover:bg-red-50"
                              onClick={() => revocarQR(f.id)}
                              disabled={revocando === f.id}
                            >
                              {revocando === f.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <ShieldX className="w-3 h-3" />
                              }
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal QR */}
      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setQrModal(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl"
            style={{ maxHeight: "calc(100vh - 70px)", marginBottom: "65px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header fijo */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Código QR del paciente</h2>
                <p className="text-xs text-gray-500">{qrModal.pacienteNombre}</p>
              </div>
              <button onClick={() => setQrModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Contenido */}
            <div className="overflow-y-auto px-5 py-5 space-y-4 pb-8">
              {/* Aviso regeneración */}
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs">
                <RotateCcw className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Se generó un nuevo PIN. El QR anterior ya no funciona — comparte este al paciente.</span>
              </div>

              {/* QR Image */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrModal.qrImagen} alt="QR Ficha" className="w-56 h-56" />
                </div>
              </div>

              {/* PIN */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">PIN del paciente</p>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold tracking-[0.4em] text-gray-900 font-mono">
                    {qrModal.pin}
                  </span>
                  <button onClick={copiarPin}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition">
                    {pinCopiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">Díselo en persona o envíalo por separado</p>
              </div>

              {/* URL */}
              <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-2">
                <p className="text-xs text-gray-500 flex-1 truncate">{qrModal.url}</p>
                <button onClick={copiarUrl}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition shrink-0">
                  {urlCopiada ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                </button>
              </div>

              {/* Instrucciones */}
              <div className="bg-emerald-50 rounded-2xl p-4">
                <p className="text-xs font-semibold text-emerald-800 mb-2">¿Cómo compartirlo?</p>
                <ol className="text-xs text-emerald-700 space-y-1.5 list-decimal list-inside">
                  <li>El paciente escanea el QR con la cámara del celular</li>
                  <li>Ingresa el PIN de 4 dígitos que le des</li>
                  <li>Ve su ficha simplificada en lenguaje sencillo</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
