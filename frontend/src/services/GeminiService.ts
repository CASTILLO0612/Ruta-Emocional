import { apiRequest } from './apiClient';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de respuesta del análisis MENTA
// ─────────────────────────────────────────────────────────────────────────────

export interface MentaAnalysis {
  primary_need: string;
  recommended_modality: 'chat' | 'call' | 'in-person';
  suggested_budget_min: number;
  suggested_budget_max: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Respuestas de fallback locales (solo si el backend no responde)
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_FALLBACK: MentaAnalysis = {
  primary_need: 'Bienestar emocional general',
  recommended_modality: 'chat',
  suggested_budget_min: 250,
  suggested_budget_max: 500,
  summary:
    'Estoy aquí para ayudarte. Te conecto con un psicólogo que puede orientarte mejor.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Función principal — llama al backend de forma segura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analiza síntomas emocionales del usuario enviando el mensaje al backend,
 * donde se procesa de forma segura con la API de Google Gemini.
 * La API Key de Gemini NUNCA se expone al cliente.
 */
export async function analyzeSymptomsWithMENTA(
  userMessage: string
): Promise<MentaAnalysis> {
  try {
    const result = await apiRequest<MentaAnalysis>('/menta/analyze', 'POST', {
      message: userMessage,
    });

    return result;
  } catch (error) {
    console.warn('[MENTA] Error al contactar backend, usando fallback local:', error);
    return LOCAL_FALLBACK;
  }
}
