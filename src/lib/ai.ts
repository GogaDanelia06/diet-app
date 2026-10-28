import type { Food, Nutrients } from './types'
import { uid } from './date'

// Google Gemini, called straight from the phone with the user's own free API key.
const FALLBACK_MODEL = 'gemini-3.5-flash-lite'

export interface AiItem {
  name: string
  grams: number
  portion: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface AiMeal {
  title: string
  items: AiItem[]
  notes?: string
}

export interface AiLabel {
  name: string
  brand?: string
  servingGrams?: number
  per100: Nutrients
}

export interface ChatTurn {
  role: 'user' | 'model'
  text: string
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } }

interface Config {
  key: string
  model: string
}

class AiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function callGemini(
  cfg: Config,
  body: Record<string, unknown>,
  model = cfg.model || FALLBACK_MODEL,
): Promise<string> {
  if (!cfg.key) throw new AiError('Add your free Gemini key in Me → AI assistant first.', 0)
  let res: Response
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AiError('No internet connection. AI features need to be online.', 0)
  }
  if (!res.ok) {
    // Busy or unknown model: retry once on the lighter free model.
    if ((res.status === 429 || res.status === 404 || res.status === 503) && model !== FALLBACK_MODEL) {
      return callGemini(cfg, body, FALLBACK_MODEL)
    }
    let detail = ''
    try {
      detail = (await res.json())?.error?.message ?? ''
    } catch {
      // Keep the status-only message.
    }
    if (res.status === 400 && /api key/i.test(detail)) throw new AiError('That Gemini key was rejected. Check it in Me → AI assistant.', 400)
    if (res.status === 429) throw new AiError('The free AI limit is used up for now. Wait a minute (or until tomorrow) and try again.', 429)
    throw new AiError(`AI request failed (${res.status}). ${detail}`.trim(), res.status)
  }
  const data = await res.json()
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? []
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('')
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason
    throw new AiError(reason ? `The AI returned no answer (${reason}).` : 'The AI returned no answer.', 200)
  }
  return text
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1)) as T
    throw new Error('The AI answer could not be read. Try again.')
  }
}

const NUM = { type: 'NUMBER' }
const STR = { type: 'STRING' }

const MEAL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: STR,
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: STR, portion: STR, grams: NUM, kcal: NUM, protein: NUM, carbs: NUM, fat: NUM },
        required: ['name', 'portion', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
      },
    },
    notes: STR,
  },
  required: ['title', 'items'],
}

const MEAL_RULES = `You are a precise nutritionist estimating food for a calorie-tracking app.
List each distinct food or drink separately (for example: bread, butter, coffee with milk).
For each item give a short English name, a human portion description (like "1 slice" or "2 pieces"),
the estimated weight in grams as eaten, and the calories, protein, carbs and fat (grams) for that weight.
Include hidden calories such as cooking oil, butter, sauces and dressings as their own items when they are likely present.
Recognise regional dishes, including Georgian food (khachapuri, khinkali, mtsvadi, lobio, pkhali, etc.).
If something is uncertain, give your best realistic estimate and mention it briefly in "notes". Keep "title" under 5 words.`

function cleanMeal(m: AiMeal): AiMeal {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0)
  return {
    title: m.title || 'Meal',
    notes: m.notes,
    items: (m.items ?? []).map((i) => ({
      name: String(i.name || 'Food'),
      portion: String(i.portion || ''),
      grams: n(i.grams) || 100,
      kcal: n(i.kcal),
      protein: n(i.protein),
      carbs: n(i.carbs),
      fat: n(i.fat),
    })),
  }
}

export async function analyzeMealPhoto(cfg: Config, base64Jpeg: string, hint: string): Promise<AiMeal> {
  const parts: Part[] = [
    { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } },
    { text: `Identify everything to be eaten in this photo and estimate its nutrition.${hint ? ` Extra details from the user: ${hint}` : ''}` },
  ]
  const text = await callGemini(cfg, {
    system_instruction: { parts: [{ text: MEAL_RULES }] },
    contents: [{ role: 'user', parts }],
    generation_config: { response_mime_type: 'application/json', response_schema: MEAL_SCHEMA },
  })
  return cleanMeal(parseJson<AiMeal>(text))
}

export async function analyzeMealText(cfg: Config, description: string): Promise<AiMeal> {
  const text = await callGemini(cfg, {
    system_instruction: { parts: [{ text: MEAL_RULES }] },
    contents: [{ role: 'user', parts: [{ text: `Estimate the nutrition of what I ate: ${description}` }] }],
    generation_config: { response_mime_type: 'application/json', response_schema: MEAL_SCHEMA },
  })
  return cleanMeal(parseJson<AiMeal>(text))
}

const LABEL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: STR,
    brand: STR,
    servingGrams: NUM,
    kcal: NUM,
    protein: NUM,
    carbs: NUM,
    fat: NUM,
    fiber: NUM,
    sugar: NUM,
  },
  required: ['name', 'kcal', 'protein', 'carbs', 'fat'],
}

export async function readNutritionLabel(cfg: Config, base64Jpeg: string): Promise<AiLabel> {
  const text = await callGemini(cfg, {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } },
          {
            text: `This is a food package or nutrition facts label. Read it and return values PER 100 g (or 100 ml).
If the label only shows values per serving, convert them to per 100 g using the serving size.
Convert kJ to kcal if needed (divide by 4.184). Give the serving size in grams if printed.
Use the product name and brand if visible, otherwise a short descriptive name.`,
          },
        ],
      },
    ],
    generation_config: { response_mime_type: 'application/json', response_schema: LABEL_SCHEMA },
  })
  const r = parseJson<Record<string, number | string>>(text)
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0)
  return {
    name: String(r.name || 'Packaged food'),
    brand: r.brand ? String(r.brand) : undefined,
    servingGrams: n(r.servingGrams) || undefined,
    per100: {
      kcal: Math.round(n(r.kcal)),
      protein: n(r.protein),
      carbs: n(r.carbs),
      fat: n(r.fat),
      fiber: r.fiber != null ? n(r.fiber) : undefined,
      sugar: r.sugar != null ? n(r.sugar) : undefined,
    },
  }
}

export async function coachReply(cfg: Config, context: string, history: ChatTurn[]): Promise<string> {
  return callGemini(cfg, {
    system_instruction: {
      parts: [
        {
          text: `You are a friendly, practical diet coach inside a calorie-tracking app. The user wants to lose weight safely.
Give short, concrete answers (under 150 words) using plain text and simple "- " bullet lists; no tables.
Base advice on the user's numbers below. Suggest real foods and portions with calories.
Never recommend eating below 1200 kcal (women) or 1500 kcal (men) without a doctor, and suggest seeing a doctor for medical conditions.

${context}`,
        },
      ],
    },
    contents: history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
  })
}

/** Converts an AI estimate into a food so it can be logged, re-scaled and re-used like any other. */
export function aiItemToFood(i: AiItem): Food {
  const g = i.grams > 0 ? i.grams : 100
  const f = 100 / g
  return {
    id: `ai-${uid()}`,
    name: i.name,
    per100: {
      kcal: Math.round(i.kcal * f),
      protein: Math.round(i.protein * f * 10) / 10,
      carbs: Math.round(i.carbs * f * 10) / 10,
      fat: Math.round(i.fat * f * 10) / 10,
    },
    servings: i.portion ? [{ label: i.portion, grams: Math.round(g) }] : [],
    source: 'ai',
  }
}

export async function testKey(cfg: Config): Promise<string> {
  const text = await callGemini(cfg, { contents: [{ role: 'user', parts: [{ text: 'Reply with just: OK' }] }] })
  return text.trim()
}
