import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HeartPulse, QrCode, FileText, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function PacienteHomePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "PACIENTE") redirect("/paciente-login");

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Saludo */}
      <div className="bg-emerald-700 text-white px-5 py-5 rounded-2xl shadow">
        <p className="text-xs opacity-75 uppercase tracking-wider">Bienvenido</p>
        <p className="text-xl font-bold mt-0.5">{session.user.name}</p>
        <p className="text-xs opacity-80 mt-1">Tu informacion clinica siempre contigo</p>
      </div>

      {/* Acciones principales */}
      <div className="space-y-3">
        <Link href="/paciente/historial">
          <Card className="border-emerald-100 hover:border-emerald-300 hover:shadow-sm transition cursor-pointer">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">Mis fichas medicas</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ver tu diagnostico, medicamentos e indicaciones
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Card className="border-gray-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <QrCode className="w-6 h-6 text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">Tengo un codigo QR</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Escanea el QR o ingresa el enlace que te dio tu doctor
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card className="border-gray-100 bg-gray-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <HeartPulse className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-gray-700">Como funciona</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Tu doctor crea tu ficha medica y genera un codigo QR con un PIN. Escanea el QR para ver tu diagnostico en lenguaje sencillo. Tu informacion esta protegida.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
