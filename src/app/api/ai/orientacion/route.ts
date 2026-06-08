import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// El chunking hace varias llamadas seguidas: damos margen de tiempo.
export const maxDuration = 60;

export interface OrientacionRequest {
  textodocumento: string;
}

export interface OrientacionResponse {
  resumen: string;
  puntosClave: string;
  sugerencia: string;
}

// Tamano maximo de cada bloque (en caracteres) para procesar por partes.
const CHUNK_SIZE = 7000;

const REGLAS = `Eres un asistente que ayuda a pacientes en Peru a ENTENDER documentos medicos
(examenes de laboratorio, recetas, informes) escritos en lenguaje tecnico. Tu rol es ORIENTAR y EXPLICAR,
NUNCA diagnosticar ni indicar tratamientos.

REGLAS CRITICAS:
1. NO des un diagnostico. NO indiques medicamentos, dosis ni tratamientos.
2. NO inventes informacion que no este en el documento. Si algo no esta claro, dilo.
3. Usa lenguaje muy simple, como para alguien de educacion basica. Explica los terminos tecnicos entre parentesis.
4. Si hay valores fuera de rango, señalalos de forma neutral ("este valor aparece mas alto de lo normal"), sin alarmar ni concluir nada.
5. SE COMPLETO: explica CADA examen, valor, hallazgo, medicamento o indicacion que encuentres, uno por uno. No omitas nada. Usa vinetas con guiones (-) y un salto de linea entre cada punto.`;

// Prompt para el PRIMER bloque: devuelve resumen + puntos
const PROMPT_PRIMERO = `${REGLAS}

Responde EXACTAMENTE en este formato de texto plano (NADA de JSON, NADA de markdown):

RESUMEN:
(2 a 4 oraciones simples: que tipo de documento es y de que trata en general)

PUNTOS:
- (primer examen, valor, hallazgo o indicacion, explicado simple)
- (el siguiente)
- (y asi, uno por linea, con TODOS los del fragmento)`;

// Prompt para bloques siguientes: solo los puntos de ese fragmento
const PROMPT_CONTINUACION = `${REGLAS}

Este es la CONTINUACION de un documento mas largo. Explica solo el contenido nuevo de este fragmento.
Responde EXACTAMENTE en este formato de texto plano (NADA de JSON, NADA de markdown):

PUNTOS:
- (cada examen, valor, hallazgo o indicacion de este fragmento, explicado simple, uno por linea)`;

const SUGERENCIA_FIJA =
  "Esto es solo una orientacion para ayudarte a entender tu documento. Llevalo a tu medico para que te lo explique en detalle y te diga que hacer. Solo un profesional puede darte un diagnostico y un tratamiento.";

const DEMO_RESPONSE: OrientacionResponse = {
  resumen: "[DEMO] Este es un examen de sangre. Mide diferentes valores de tu cuerpo, como el azucar y el colesterol.",
  puntosClave: "[DEMO]\n- Azucar en sangre: aparece un poco mas alta de lo normal.\n- Colesterol: dentro de lo esperado.\n- Hemoglobina: dentro de lo normal.",
  sugerencia: SUGERENCIA_FIJA,
};

async function llamarIA(systemPrompt: string, userPrompt: string): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    const Groq = (await import("groq-sdk")).default;
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content ?? "";
  }
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

// Separa la respuesta en RESUMEN y PUNTOS a partir de los marcadores.
function extraerSecciones(texto: string): { resumen: string; puntos: string } {
  const t = texto.replace(/```/g, "").trim();
  const mPuntos = t.match(/PUNTOS\s*:/i);

  if (!mPuntos) {
    // Sin marcador: tomamos todo como puntos
    return { resumen: "", puntos: t.replace(/RESUMEN\s*:/i, "").trim() };
  }

  const idxPuntos = mPuntos.index!;
  const antes = t.slice(0, idxPuntos);
  const mResumen = antes.match(/RESUMEN\s*:/i);
  const resumen = mResumen
    ? antes.slice(mResumen.index! + mResumen[0].length).trim()
    : antes.trim();
  const puntos = t.slice(idxPuntos + mPuntos[0].length).trim();

  return { resumen, puntos };
}

// Divide el texto en bloques sin cortar a la mitad de un parrafo/pagina
function dividirEnChunks(texto: string, maxChars: number): string[] {
  const bloques = texto.split(/\n\n+/);
  const chunks: string[] = [];
  let actual = "";
  for (const b of bloques) {
    if (actual.length + b.length > maxChars && actual) {
      chunks.push(actual.trim());
      actual = "";
    }
    actual += b + "\n\n";
  }
  if (actual.trim()) chunks.push(actual.trim());
  return chunks;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "PACIENTE") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const tieneIA = !!process.env.GROQ_API_KEY || !!process.env.ANTHROPIC_API_KEY;
  if (!tieneIA) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json(DEMO_RESPONSE);
  }

  let body: OrientacionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const texto = (body.textodocumento ?? "").trim();
  if (!texto || texto.length < 10) {
    return NextResponse.json({ error: "El documento no contiene texto suficiente para orientarte" }, { status: 400 });
  }

  try {
    const chunks = dividirEnChunks(texto, CHUNK_SIZE);
    let resumen = "";
    const partesPuntos: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const esPrimero = i === 0;
      const systemPrompt = esPrimero ? PROMPT_PRIMERO : PROMPT_CONTINUACION;
      const etiqueta = chunks.length > 1 ? ` (parte ${i + 1} de ${chunks.length})` : "";
      const userPrompt = `Documento medico del paciente${etiqueta}:\n\n${chunks[i]}\n\nExplica este contenido de forma simple y orientativa.`;

      const respuesta = await llamarIA(systemPrompt, userPrompt);
      const { resumen: r, puntos } = extraerSecciones(respuesta);

      if (esPrimero && r) resumen = r;
      if (puntos) partesPuntos.push(puntos);
    }

    const puntosClave = partesPuntos.join("\n\n").trim();
    if (!puntosClave) {
      return NextResponse.json(
        { error: "No se pudo procesar el documento. Intenta con una imagen mas clara." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      resumen: resumen || "Documento medico. Revisa los puntos importantes a continuacion.",
      puntosClave,
      sugerencia: SUGERENCIA_FIJA,
    } satisfies OrientacionResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    if (/rate limit|429|tokens per day|rate_limit/i.test(msg)) {
      return NextResponse.json(
        { error: "Se alcanzo el limite diario de uso gratuito de la IA. Intenta de nuevo en unos minutos." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: `Error al procesar con IA: ${msg}` }, { status: 500 });
  }
}
