import { Platform } from 'react-native';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? 'PLACEHOLDER_GEMINI_API_KEY';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface MentaAnalysis {
  primary_need: string;
  recommended_modality: 'chat' | 'call' | 'in-person';
  suggested_budget_min: number;
  suggested_budget_max: number;
  summary: string;
}

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
  default: {
    primary_need: 'Bienestar emocional general',
    recommended_modality: 'chat',
    suggested_budget_min: 250,
    suggested_budget_max: 500,
    summary:
      'Estoy aquí para ayudarte. Te conecto con un psicólogo que puede orientarte mejor.',
  },
};

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

export async function analyzeSymptomsWithMENTA(
  userMessage: string
): Promise<MentaAnalysis> {
  const fetchUrl = Platform.OS === 'web'
    ? `https://corsproxy.io/?${GEMINI_URL}`
    : GEMINI_URL;

  try {
    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: buildPrompt(userMessage) }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!response.ok) {
      console.warn('[MENTA] API error, using fallback');
      return getFallbackResponse(userMessage);
    }

    const data = await response.json();
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed: MentaAnalysis = JSON.parse(cleaned);
    return parsed;
  } catch (error) {
    console.warn('[MENTA] Parse error, using fallback:', error);
    return getFallbackResponse(userMessage);
  }
}

function getFallbackResponse(message: string): MentaAnalysis {
  const lower = message.toLowerCase();
  
  if (lower.includes('ansiedad') || lower.includes('estres') || lower.includes('nervios') || lower.includes('trabajo')) {
    return FALLBACK_RESPONSES.ansiedad;
  }
  if (lower.includes('triste') || lower.includes('depresion') || lower.includes('lloro') || lower.includes('llorar') || lower.includes('duelo')) {
    return FALLBACK_RESPONSES.depresion;
  }
  
  return FALLBACK_RESPONSES.default;
}
