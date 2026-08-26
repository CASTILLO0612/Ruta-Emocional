import { Request, Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de respuesta de MENTA
// ─────────────────────────────────────────────────────────────────────────────

interface MentaAnalysis {
  primary_need: string;
  recommended_modality: 'chat' | 'call' | 'in-person';
  suggested_budget_min: number;
  suggested_budget_max: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Respuestas de fallback cuando la API no está disponible
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_RESPONSES: Record<string, MentaAnalysis> = {
  ansiedad: {
    primary_need: 'Manejo de ansiedad y estrés',
    recommended_modality: 'chat',
    suggested_budget_min: 300,
    suggested_budget_max: 600,
    summary:
      'Basado en tus síntomas, te recomiendo comenzar con una sesión de chat para técnicas de respiración y mindfulness.',
  },
  depresion: {
    primary_need: 'Apoyo emocional y depresión',
    recommended_modality: 'call',
    suggested_budget_min: 400,
    suggested_budget_max: 800,
    summary:
      'Es importante que hables con un especialista. Te recomiendo una sesión de llamada para una evaluación más profunda.',
  },
  relacion: {
    primary_need: 'Conflictos en relaciones interpersonales',
    recommended_modality: 'call',
    suggested_budget_min: 350,
    suggested_budget_max: 700,
    summary:
      'Los conflictos de relación se abordan mejor con una conversación guiada. Te recomiendo una sesión de llamada.',
  },
  trauma: {
    primary_need: 'Procesamiento de trauma',
    recommended_modality: 'in-person',
    suggested_budget_min: 500,
    suggested_budget_max: 1000,
    summary:
      'Para procesar experiencias traumáticas, una sesión presencial con un profesional especializado es lo más recomendado.',
  },
  default: {
    primary_need: 'Bienestar emocional general',
    recommended_modality: 'chat',
    suggested_budget_min: 250,
    suggested_budget_max: 500,
    summary:
      'Estoy aquí para ayudarte. Te conecto con un psicólogo que puede orientarte mejor.',
  },
};

function getFallbackResponse(userMessage: string): MentaAnalysis {
  const lower = userMessage.toLowerCase();
  for (const [keyword, response] of Object.entries(FALLBACK_RESPONSES)) {
    if (keyword !== 'default' && lower.includes(keyword)) {
      return response;
    }
  }
  return FALLBACK_RESPONSES.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt de triaje para Gemini
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(userMessage: string): string {
  return `Eres MENTA, un asistente de triaje cognitivo inicial para la app Ruta Emocional.
Tu rol es identificar la necesidad emocional principal del usuario y recomendar la modalidad de atención más adecuada.

Responde ÚNICAMENTE en JSON válido con esta estructura exacta:
{
  "primary_need": "string (necesidad emocional principal identificada)",
  "recommended_modality": "chat | call | in-person",
  "suggested_budget_min": number (en C$ córdobas, mínimo razonable),
  "suggested_budget_max": number (en C$ córdobas, máximo razonable),
  "summary": "string (1-2 oraciones empáticas explicando tu recomendación)"
}

Mensaje del usuario: "${userMessage}"

Responde SOLO con el JSON, sin texto adicional.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controlador principal — POST /api/menta/analyze
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeSymptoms(req: Request, res: Response): Promise<void> {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ message: 'Se requiere un mensaje para el análisis' });
      return;
    }

    // Validar longitud máxima del mensaje (seguridad)
    if (message.length > 2000) {
      res.status(400).json({ message: 'El mensaje excede la longitud máxima permitida (2000 caracteres)' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'PLACEHOLDER_GEMINI_API_KEY') {
      console.warn('[MENTA] GEMINI_API_KEY no configurada, usando respuesta de fallback');
      res.json(getFallbackResponse(message));
      return;
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildPrompt(message.trim()) }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!geminiResponse.ok) {
      console.warn(`[MENTA] Gemini API error (${geminiResponse.status}), usando fallback`);
      res.json(getFallbackResponse(message));
      return;
    }

    const data = await geminiResponse.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Limpiar delimitadores de markdown y parsear JSON
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed: MentaAnalysis = JSON.parse(cleaned);

    // Validar estructura mínima de la respuesta
    if (!parsed.primary_need || !parsed.summary) {
      console.warn('[MENTA] Respuesta de Gemini incompleta, usando fallback');
      res.json(getFallbackResponse(message));
      return;
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('[MENTA] Error en análisis:', error.message);
    // Fallback seguro: nunca dejamos al usuario sin respuesta
    const { message: userMsg } = req.body;
    res.json(getFallbackResponse(userMsg || ''));
  }
}
