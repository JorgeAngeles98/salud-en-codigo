import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export interface SimplificarRequest {
  textoOriginal: string;
  pacienteNombre: string;
  pacienteEdad: number;
  condiciones: string[];
}

export interface SimplificarResponse {
  diagnostico: string;
  tratamiento: string;
  indicaciones: string;
  signosAlarma: string;
  proximoControl: string;
}

const SYSTEM_PROMPT = `Eres un asistente medico especializado en comunicacion con pacientes en Peru.
Tu tarea es tomar una nota clinica escrita por un medico en lenguaje tecnico y transformarla en
informacion clara, sencilla y comprensible para un paciente con bajo nivel de alfabetizacion.

REGLAS IMPORTANTES:
1. Usa un lenguaje muy simple, como si hablaras con alguien de educacion basica
2. Evita terminos medicos tecnicos; si debes usarlos, explicalos entre parentesis
3. DESARROLLA y EXPLICA bien lo que el medico escribio: para cada diagnostico, explica en palabras simples QUE es la condicion, POR QUE le pasa y QUE significa para el paciente en su dia a dia. El objetivo es que el paciente entienda de verdad, no solo una frase corta.
4. Usa el contexto del paciente (edad, condiciones) para personalizar la explicacion
5. Los signos de alarma deben ser MUY claros, usar frases como "Ve a emergencia si..."

REGLA CRITICA DE FIDELIDAD (la mas importante):
- NUNCA inventes informacion que no este escrita en la nota del medico.
- NO inventes dosis, horarios, nombres de medicamentos, ni fechas o tiempos de control.
- Si la nota NO indica una dosis o un horario, no lo supongas: escribe "segun te indique tu medico".
- Si la nota NO indica cuando regresar, en "proximoControl" escribe "Pregunta a tu medico cuando debes regresar".
- NO omitas medicamentos, diagnosticos ni complicaciones que SI esten en la nota; menciona todos.
- Solo simplificas y explicas el lenguaje; no agregas ni quitas hechos clinicos.

FORMATO:
6. En "signosAlarma" NO repitas la frase introductoria; empieza directo con las senales (el sistema ya muestra el titulo "Ve a emergencia si tienes:").
7. Responde SIEMPRE en el siguiente formato JSON exacto, sin texto adicional:

{
  "diagnostico": "Explicacion DESARROLLADA y simple de TODO lo que tiene el paciente segun la nota: que es cada condicion, por que ocurre y que implica para el paciente, en lenguaje sencillo",
  "tratamiento": "Lista clara de TODOS los medicamentos de la nota con nombre, dosis y horario tal como aparecen, explicando para que sirve cada uno; si un dato no esta, di 'segun te indique tu medico'",
  "indicaciones": "Que debe hacer el paciente en casa segun la nota: dieta, reposo, cuidados especificos",
  "signosAlarma": "Senales de peligro por las que debe ir a emergencia (sin repetir 'Ve a emergencia si')",
  "proximoControl": "Cuando regresar SOLO si la nota lo indica; si no, 'Pregunta a tu medico cuando debes regresar'"
}`;

// Datos de demo cuando no hay API key
const DEMO_RESPONSE: SimplificarResponse = {
  diagnostico: "[DEMO] Tienes presion arterial alta (hipertension). Esto significa que tu corazon trabaja con mas fuerza de la normal. Con el tratamiento correcto puedes llevar una vida normal.",
  tratamiento: "[DEMO] Enalapril 10mg: tomar 1 pastilla cada manana con agua. Amlodipino 5mg: tomar 1 pastilla cada noche antes de dormir. No dejes de tomar tus pastillas aunque te sientas bien.",
  indicaciones: "[DEMO] Come con poca sal, nada de comida en bolsita ni frituras. Camina 30 minutos al dia. No fumes ni tomes alcohol. Toma tus pastillas a la misma hora todos los dias.",
  signosAlarma: "[DEMO] Ve a emergencia si tienes: dolor de cabeza muy fuerte, vision borrosa, dolor en el pecho, o dificultad para hablar.",
  proximoControl: "[DEMO] Regresa al centro de salud en 2 semanas para controlar tu presion.",
};

async function llamarGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const Groq = (await import("groq-sdk")).default;
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 2048,
    temperature: 0.3,
  });

  return completion.choices[0]?.message?.content ?? "";
}

async function llamarAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!["PROFESIONAL", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Sin API key → modo demo
  const tieneGroq = !!process.env.GROQ_API_KEY;
  const tieneAnthropic = !!process.env.ANTHROPIC_API_KEY;

  if (!tieneGroq && !tieneAnthropic) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json(DEMO_RESPONSE);
  }

  let body: SimplificarRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const { textoOriginal, pacienteNombre, pacienteEdad, condiciones } = body;

  if (!textoOriginal || textoOriginal.trim().length < 10) {
    return NextResponse.json({ error: "El texto clinico es muy corto" }, { status: 400 });
  }

  const condicionesTexto = condiciones.length > 0
    ? `Condiciones previas: ${condiciones.map((c) => c.replace(/_/g, " ")).join(", ")}.`
    : "Sin condiciones previas registradas.";

  const userPrompt = `Paciente: ${pacienteNombre}, ${pacienteEdad} anios. ${condicionesTexto}

Nota clinica del medico:
${textoOriginal.trim()}

Simplifica esta informacion para el paciente.`;

  try {
    // Groq tiene prioridad (gratis), Anthropic como fallback
    let responseText = "";
    let proveedor = "";

    if (tieneGroq) {
      responseText = await llamarGroq(SYSTEM_PROMPT, userPrompt);
      proveedor = "groq/llama-3.3-70b";
    } else {
      responseText = await llamarAnthropic(SYSTEM_PROMPT, userPrompt);
      proveedor = "anthropic/claude";
    }

    // Parsear JSON (con rescate del primer objeto {...} si viene texto extra)
    let resultado: SimplificarResponse | null = null;
    const limpio = responseText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    try {
      resultado = JSON.parse(limpio);
    } catch {
      const ini = limpio.indexOf("{");
      const fin = limpio.lastIndexOf("}");
      if (ini !== -1 && fin > ini) {
        try {
          resultado = JSON.parse(limpio.slice(ini, fin + 1));
        } catch {
          resultado = null;
        }
      }
    }

    if (!resultado) {
      return NextResponse.json(
        {
          error: "No se pudo interpretar el texto. Es posible que el documento escaneado no se haya leido bien; revisa o corrige el texto en el campo antes de simplificar.",
          rawResponse: responseText,
        },
        { status: 422 }
      );
    }

    // Rellenar campos vacíos
    const campos: (keyof SimplificarResponse)[] = ["diagnostico", "tratamiento", "indicaciones", "signosAlarma", "proximoControl"];
    for (const campo of campos) {
      if (!resultado[campo]) resultado[campo] = "Consulta con tu medico para mas detalles.";
    }

    console.log(`[AI] Simplificacion completada con ${proveedor}`);
    return NextResponse.json(resultado);

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[AI] Error:", msg);
    // Limite de uso gratuito de Groq alcanzado
    if (/rate limit|429|tokens per day|rate_limit/i.test(msg)) {
      return NextResponse.json(
        { error: "Se alcanzo el limite diario de uso gratuito de la IA. Intenta de nuevo en unos minutos." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: `Error al procesar con IA: ${msg}` }, { status: 500 });
  }
}
