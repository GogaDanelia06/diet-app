import type { Food, Nutrients, PlanItem, PlanPrefs } from './types'
import { uid } from './date'
import type { RawPlanMeal } from './plan'
import { aiLanguageNote, t } from './i18n'

// Google Gemini, called straight from the phone with the user's own free API key.
const FALLBACK_MODEL = 'gemini-3.5-flash-lite'

export type AiItem = PlanItem

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
  if (!cfg.key) throw new AiError(t('Add your free Gemini key in Me → AI assistant first.'), 0)
  let res: Response
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AiError(t('No internet connection. AI features need to be online.'), 0)
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
    if (res.status === 400 && /api key/i.test(detail)) throw new AiError(t('That Gemini key was rejected. Check it in Me → AI assistant.'), 400)
    if (res.status === 429) throw new AiError(t('The free AI limit is used up for now. Wait a minute (or until tomorrow) and try again.'), 429)
    throw new AiError(`${t('AI request failed ({s}).', { s: res.status })} ${detail}`.trim(), res.status)
  }
  const data = await res.json()
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? []
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('')
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason
    throw new AiError(reason ? t('The AI returned no answer ({r}).', { r: reason }) : t('The AI returned no answer.'), 200)
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
    throw new Error(t('The AI answer could not be read. Try again.'))
  }
}

const NUM = { type: 'NUMBER' }
const STR = { type: 'STRING' }

const ITEMS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { name: STR, portion: STR, grams: NUM, kcal: NUM, protein: NUM, carbs: NUM, fat: NUM },
    required: ['name', 'portion', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
  },
}

const MEAL_SCHEMA = {
  type: 'OBJECT',
  properties: { title: STR, items: ITEMS_SCHEMA, notes: STR },
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
    system_instruction: { parts: [{ text: MEAL_RULES + aiLanguageNote() }] },
    contents: [{ role: 'user', parts }],
    generation_config: { response_mime_type: 'application/json', response_schema: MEAL_SCHEMA },
  })
  return cleanMeal(parseJson<AiMeal>(text))
}

export async function analyzeMealText(cfg: Config, description: string): Promise<AiMeal> {
  const text = await callGemini(cfg, {
    system_instruction: { parts: [{ text: MEAL_RULES + aiLanguageNote() }] },
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
Use the product name and brand if visible, otherwise a short descriptive name.${aiLanguageNote()}`,
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
Never recommend eating below 1200 kcal (women) or 1500 kcal (men) without a doctor, and suggest seeing a doctor for medical conditions.${aiLanguageNote()}

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

const PLAN_MEAL_SCHEMA = {
  type: 'OBJECT',
  properties: { meal: STR, name: STR, description: STR, items: ITEMS_SCHEMA },
  required: ['meal', 'name', 'description', 'items'],
}

const PLAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    days: { type: 'ARRAY', items: { type: 'OBJECT', properties: { meals: { type: 'ARRAY', items: PLAN_MEAL_SCHEMA } }, required: ['meals'] } },
    tips: STR,
  },
  required: ['days'],
}

const DIET_TEXT: Record<PlanPrefs['diet'], string> = {
  any: 'No restrictions; include lean meat, fish, eggs, dairy, grains, legumes, vegetables and fruit.',
  vegetarian: 'Vegetarian: no meat or fish; eggs and dairy are fine.',
  pescatarian: 'Pescatarian: fish and seafood but no other meat; eggs and dairy are fine.',
  vegan: 'Vegan: no animal products at all (no meat, fish, eggs, dairy or honey).',
}

const PLANNER_RULES = `You are a registered dietitian writing practical weight-loss meal plans for a calorie-tracking app.
Every item has its weight in grams as eaten (cooked weight for cooked food) and its calories, protein, carbs and fat for that weight, from standard nutrition tables.
List cooking oil, butter, sauces and dressings as their own items. Use everyday ingredients from a normal supermarket or market.
For cooked dishes, list the main ingredients as separate items (for lobio: kidney beans, onion, walnuts, sunflower oil) so they can go on a shopping list; ready-made foods such as bread, cheese or yogurt stay as one item.
Favour filling, high-protein, high-fibre meals. Regional dishes, including Georgian food, are welcome in sensible portions.
Each meal has a short name, a one- or two-sentence description of how to prepare it, and its items.
The "meal" field is exactly one of: breakfast, lunch, dinner, snack.`

export interface PlanRequest {
  days: number
  targetKcal: number
  protein: number
  slots: { meal: string; kcal: number }[]
  prefs: PlanPrefs
  person: string
}

function planConstraints(r: Omit<PlanRequest, 'days' | 'slots'>) {
  const p = r.prefs
  return [
    `About the person: ${r.person}`,
    `Diet: ${DIET_TEXT[p.diet]}`,
    p.likes.trim() && `Foods and cuisines they like: ${p.likes.trim()}.`,
    p.avoid.trim() && `Never use these (dislikes or allergies): ${p.avoid.trim()}.`,
    p.cooking === 'quick'
      ? 'They want quick, simple meals: under 20 minutes of work, few ingredients; reusing leftovers is fine.'
      : 'They enjoy cooking, so more involved recipes are fine.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Asks the AI for a multi-day meal plan that fits the calorie target. */
export async function generateMealPlan(cfg: Config, r: PlanRequest): Promise<{ days?: { meals?: RawPlanMeal[] }[]; tips?: string }> {
  const slots = r.slots.map((s) => `${s.meal} about ${s.kcal} kcal`).join(', ')
  const text = await callGemini(cfg, {
    system_instruction: { parts: [{ text: PLANNER_RULES + aiLanguageNote() }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Make a ${r.days}-day meal plan.
Each day has these meals in this order: ${slots}.
Each day must total ${r.targetKcal} kcal (within 5%) with at least ${r.protein} g protein.
Give different meals on different days, though a dinner may come back as the next day's lunch to save cooking.
${planConstraints(r)}
Finish with "tips": two or three short, practical tips for sticking to this plan.`,
          },
        ],
      },
    ],
    generation_config: { response_mime_type: 'application/json', response_schema: PLAN_SCHEMA },
  })
  return parseJson(text)
}

/** Asks the AI for one replacement meal with about the same calories. */
export async function swapPlanMeal(
  cfg: Config,
  r: Omit<PlanRequest, 'days' | 'slots'> & { meal: string; kcal: number; avoidMeals: string[] },
): Promise<RawPlanMeal> {
  const text = await callGemini(cfg, {
    system_instruction: { parts: [{ text: PLANNER_RULES + aiLanguageNote() }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Suggest one different ${r.meal} of about ${r.kcal} kcal (within 5%).
It must not be any of these: ${r.avoidMeals.join('; ')}.
${planConstraints(r)}`,
          },
        ],
      },
    ],
    generation_config: { response_mime_type: 'application/json', response_schema: PLAN_MEAL_SCHEMA },
  })
  return parseJson(text)
}

export interface AiWorkoutPart {
  name: string
  minutes: number
  met: number
}

const WORKOUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    activities: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { name: STR, minutes: NUM, met: NUM }, required: ['name', 'minutes', 'met'] },
    },
  },
  required: ['activities'],
}

/** Splits a described workout into activities with minutes and a Compendium MET value; calories are worked out locally. */
export async function estimateWorkout(cfg: Config, description: string): Promise<AiWorkoutPart[]> {
  const text = await callGemini(cfg, {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Split this workout into separate activities. For each give a short English name, its minutes, and its MET value from the Compendium of Physical Activities (gross MET, matching the described intensity).
If the total time isn't given, estimate a realistic duration. Count rest between sets as part of a strength session, not separately.
Workout: ${description}${aiLanguageNote()}`,
          },
        ],
      },
    ],
    generation_config: { response_mime_type: 'application/json', response_schema: WORKOUT_SCHEMA },
  })
  const r = parseJson<{ activities?: Partial<AiWorkoutPart>[] }>(text)
  return (r.activities ?? [])
    .map((a) => ({
      name: String(a.name || 'Exercise'),
      minutes: Math.max(0, Math.round(Number(a.minutes) || 0)),
      // Clamp to the Compendium's range so a bad answer can't inflate calories.
      met: Math.min(20, Math.max(1, Number(a.met) || 3)),
    }))
    .filter((a) => a.minutes > 0)
}

export interface AiWeeklyReport {
  score: number
  headline: string
  summary: string
  wins: string[]
  tips: string[]
  focus: string
}

const REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: NUM,
    headline: STR,
    summary: STR,
    wins: { type: 'ARRAY', items: STR },
    tips: { type: 'ARRAY', items: STR },
    focus: STR,
  },
  required: ['score', 'headline', 'summary', 'wins', 'tips', 'focus'],
}

/** Reviews a week of logs and returns a score, wins and three concrete tips. */
export async function weeklyReport(cfg: Config, week: string): Promise<AiWeeklyReport> {
  const text = await callGemini(cfg, {
    system_instruction: {
      parts: [
        {
          text: `You are an encouraging but honest diet coach reviewing one week of a weight-loss diary.
Score the week from 0 to 100 for how well it supports safe, steady weight loss (calories near target, enough protein and fibre, consistency of logging, activity, weight trend).
"headline": one short upbeat line (under 8 words). "summary": 2 sentences on what happened, using the real numbers.
"wins": 2 or 3 specific things that went well. "tips": exactly 3 concrete, practical changes for next week, naming real foods, amounts or times.
"focus": the single most important thing to work on next week, under 10 words.
If few days were logged, say so kindly and make logging every day one of the tips. Never suggest eating below the person's target.${aiLanguageNote()}`,
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: week }] }],
    generation_config: { response_mime_type: 'application/json', response_schema: REPORT_SCHEMA },
  })
  const r = parseJson<Partial<AiWeeklyReport>>(text)
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : [])
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
    headline: String(r.headline || ''),
    summary: String(r.summary || ''),
    wins: list(r.wins).slice(0, 3),
    tips: list(r.tips).slice(0, 3),
    focus: String(r.focus || ''),
  }
}
