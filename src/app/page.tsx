import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  HeartPulse,
  Stethoscope,
  QrCode,
  ShieldCheck,
  Smartphone,
  ArrowRight,
} from "lucide-react";

export default async function Home() {
  const session = await auth();

  // Si ya está autenticado, redirigir directo al dashboard
  if (session?.user) {
    switch (session.user.role) {
      case "ADMIN":
        redirect("/admin");
      case "PROFESIONAL":
        redirect("/profesional");
      case "PACIENTE":
        redirect("/paciente");
      default:
        redirect("/login");
    }
  }

  // Landing page pública
  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-base">Salud en Código</span>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center max-w-lg mx-auto w-full">
        <div className="w-20 h-20 rounded-3xl bg-emerald-700 flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
          <HeartPulse className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-3">
          Tu información clínica,<br />
          <span className="text-emerald-700">siempre contigo</span>
        </h1>

        <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-xs">
          Fichas médicas simplificadas con IA. Accede a tu historial con un QR
          o desde tu cuenta, en cualquier momento.
        </p>

        {/* Botones de acceso */}
        <div className="w-full space-y-3 mb-10">
          <Link
            href="/paciente-login"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-200 hover:bg-emerald-800 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Soy Paciente</p>
                <p className="text-xs text-emerald-200 font-normal">Ver mis fichas médicas</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-300" />
          </Link>

          <Link
            href="/login"
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-white border border-gray-200 text-gray-800 font-semibold hover:border-emerald-300 hover:shadow-sm active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-800">Soy Profesional de Salud</p>
                <p className="text-xs text-gray-400 font-normal">Acceso para médicos y enfermeros</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-300" />
          </Link>
        </div>

        {/* Features */}
        <div className="w-full grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-2 px-2 py-4 rounded-2xl bg-white border border-gray-100">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-[11px] text-gray-500 text-center leading-tight font-medium">
              Acceso por QR seguro
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 px-2 py-4 rounded-2xl bg-white border border-gray-100">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-[11px] text-gray-500 text-center leading-tight font-medium">
              Fichas simplificadas con IA
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 px-2 py-4 rounded-2xl bg-white border border-gray-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-[11px] text-gray-500 text-center leading-tight font-medium">
              Datos protegidos Ley 29733
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-5 text-[11px] text-gray-400 px-6">
        ODS 3 · Salud y Bienestar · Perú
      </footer>
    </main>
  );
}
