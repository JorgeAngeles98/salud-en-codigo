import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";

// ── Tipos ──────────────────────────────────────────────────────────────────────

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

// ── Prompt del sistema ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente medico especializado en comunicacion con pacientes en Peru.
Tu tarea es tomar una nota clinica escrita por un medico en lenguaje tecnico y transformarla en
informacion clara, sencilla y comprensible para un paciente con bajo nivel de alfabetizacion.

REGLAS IMPORTANTES:
1. Usa un lenguaje muy simple, como si hablaras con alguien de educacion basica
2. Evita terminos medicos tecnicos; si debes usarlos, explicaos entre parentesis
3. Se directo y concreto, no uses frases largas
4. Usa el contexto del paciente (edad, condiciones) para personalizar la explicacion
5. Los signos de alarma deben ser MUY claros, usar frases como "Ve a emergencia si..."
6. Responde SIEMPRE en el siguiente formato JSON exacto, sin texto adicional:

{
  "diagnostico": "Explicacion simple de que tiene el paciente (max 3 oraciones)",
  "tratamiento": "Lista clara de medicamentos con nombre comun, dosis y horario en lenguaje simple",
  "indicaciones": "Que debe hacer el paciente en casa: dieta, reposo, cuidados especificos",
  "signosAlarma": "Senales de peligro por las que debe ir a emergencia inmediatamente",
  "proximoControl": "Cuando debe regresar al medico y para que"
}`;

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verificar autenticacion
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Verificar que el usuario es profesional o admin
  if (!["PROFESIONAL", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Modo demo: si no hay API key, devolver datos de prueba
  if (!process.env.ANTHROPIC_API_KEY) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({
      diagnostico:
        "[MODO DEMO] Tienes presion arterial alta (hipertension). Esto significa que tu corazon trabaja con mas fuerza de la normal. Con el tratamiento correcto puedes llevar una vida normal.",
      tratamiento:
        "[MODO DEMO] Enalapril 10mg: tomar 1 pastilla cada manana con agua. Amlodipino 5mg: tomar 1 pastilla cada noche antes de dormir. No dejes de tomar tus pastillas aunque te sientas bien.",
      indicaciones:
        "[MODO DEMO] Come con poca sal, nada de comida en bolsita ni frituras. Camina 30 minutos al dia. No fumes ni tomes alcohol. Toma tus pastillas a la misma hora todos los dias.",
      signosAlarma:
        "[MODO DEMO] Ve a emergencia si tienes: dolor de cabeza muy fuerte que no pasa, vision borrosa o ves luces, dolor en el pecho, entumecimiento en la cara o brazos, o dificultad para hablar.",
      proximoControl:
        "[MODO DEMO] Regresa al centro de salud en 2 semanas para controlar tu presion. Trae tus pastillas para que el medico las revise.",
    } satisfies SimplificarResponse);
  }

  // Parsear body
  let body: SimplificarRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const { textoOriginal, pacienteNombre, pacienteEdad, condiciones } = body;

  if (!textoOriginal || textoOriginal.trim().length < 10) {
    return NextResponse.json(
      { error: "El texto clinico es muy corto" },
      { status: 400 }
    );
  }

  const condicionesTexto =
    condiciones.length > 0
      ? `Condiciones previas: ${condiciones.map((c) => c.replace(/_/g, " ")).join(", ")}.`
      : "Sin condiciones previas registradas.";

  const userPrompt = `Paciente: ${pacienteNombre}, ${pacienteEdad} anios. ${condicionesTexto}

Nota clinica del medico:
${textoOriginal.trim()}

Simplifica esta informacion para el paciente.`;

  // Llamar a Claude API
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let resultado: SimplificarResponse;
    try {
      const jsonLimpio = responseText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();
      resultado = JSON.parse(jsonLimpio);
    } catch {
      return NextResponse.json(
        {
          error: "La IA no pudo procesar el texto. Intenta con una nota mas detallada.",
          rawResponse: responseText,
        },
        { status: 422 }
      );
    }

    const camposRequeridos: (keyof SimplificarResponse)[] = [
      "diagnostico",
      "tratamiento",
      "indicaciones",
      "signosAlarma",
      "proximoControl",
    ];
    for (const campo of camposRequeridos) {
      if (!resultado[campo]) {
        resultado[campo] = "Consulta con tu medico para mas detalles.";
      }
    }

    return NextResponse.json(resultado);
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Error desconocido al llamar a la IA";
    console.error("[AI] Error al llamar a Claude:", errorMsg);
    return NextResponse.json(
      { error: `Error al procesar con IA: ${errorMsg}` },
      { status: 500 }
    );
  }
}
