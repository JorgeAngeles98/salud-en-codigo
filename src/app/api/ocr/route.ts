import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Verificar autenticacion
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!["PROFESIONAL", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Solicitud invalida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No se recibio ningun archivo" }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "El archivo supera los 10 MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const tipo = file.type;

  try {
    // ── PDF ──────────────────────────────────────────────────────────────────
    if (tipo === "application/pdf" || file.name.endsWith(".pdf")) {
      // pdf-parse exports as CommonJS default export
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParseModule = require("pdf-parse");
      const pdfParse = typeof pdfParseModule === "function" ? pdfParseModule : pdfParseModule.default;
      const result = await pdfParse(buffer) as { text: string; numpages: number };
      const texto = result.text.trim();

      if (!texto || texto.length < 10) {
        return NextResponse.json(
          { error: "El PDF no contiene texto legible. Prueba con una imagen del documento." },
          { status: 422 }
        );
      }

      return NextResponse.json({ texto, fuente: "PDF", paginas: result.numpages });
    }

    // ── Imagen (JPG, PNG, WEBP, BMP) ─────────────────────────────────────────
    if (tipo.startsWith("image/")) {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("spa"); // Espanol

      const { data } = await worker.recognize(buffer);
      await worker.terminate();

      const texto = data.text.trim();
      if (!texto || texto.length < 10) {
        return NextResponse.json(
          { error: "No se pudo extraer texto de la imagen. Asegurate de que la imagen sea clara y legible." },
          { status: 422 }
        );
      }

      return NextResponse.json({
        texto,
        fuente: "IMAGEN",
        confianza: Math.round(data.confidence),
      });
    }

    return NextResponse.json(
      { error: "Tipo de archivo no soportado. Usa PDF, JPG o PNG." },
      { status: 415 }
    );
  } catch (err) {
    console.error("[OCR] Error:", err);
    return NextResponse.json(
      { error: "Error al procesar el archivo. Intenta con otro documento." },
      { status: 500 }
    );
  }
}
