import { useEffect, useRef, useState } from 'react'
import { coachReply, type ChatTurn } from '../lib/ai'
import { ACTIVITY } from '../lib/calc'
import { kcal } from '../lib/format'
import { currentWeight, useDay, useStore, useTargets } from '../lib/store'
import { ErrorNote, Icon, Segmented } from './ui'
import AiKeySetup from './AiKeySetup'
import MealPlanView from './MealPlan'

const STARTERS = [
  'What can I eat for dinner with my remaining calories?',
  'Which Georgian dishes are best when losing weight?',
  'Review what I ate today',
  'Give me a high-protein breakfast idea under 400 kcal',
]

export default function Coach({ date }: { date: string }) {
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)!
  const weight = useStore((s) => currentWeight(s))
  const targets = useTargets()!
  const day = useDay(date)
  const mealPlan = useStore((s) => s.mealPlan)
  const planned = mealPlan?.days.find((d) => d.date === date)?.meals ?? []
  const [view, setView] = useState<'plan' | 'chat'>('plan')
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [history, loading])

  const context = `User: ${profile.sex}, ${profile.age} years, ${profile.heightCm} cm, ${weight} kg now, goal ${profile.goalWeightKg} kg, ${ACTIVITY[profile.activity].label.toLowerCase()}.
Daily target: ${targets.kcal} kcal (protein ${targets.protein} g, carbs ${targets.carbs} g, fat ${targets.fat} g).
Food logged for ${date}: ${day.entries.length ? day.entries.map((e) => `${e.name} (${e.amountLabel}, ${Math.round(e.nutrients.kcal)} kcal, ${e.meal})`).join('; ') : 'nothing yet'}.
Eaten so far: ${Math.round(day.totals.kcal)} kcal, protein ${Math.round(day.totals.protein)} g. Exercise: ${day.burned} kcal.
Remaining today: ${Math.round(targets.kcal + (settings.addExerciseCalories ? day.burned : 0) - day.totals.kcal)} kcal.
Meal plan for ${date}: ${planned.length ? planned.map((m) => `${m.meal}: ${m.name}${m.logged ? ' (eaten)' : ''}`).join('; ') : 'none'}.`

  async function send(text: string) {
    const q = text.trim()
    if (!q || loading) return
    const next: ChatTurn[] = [...history, { role: 'user', text: q }]
    setHistory(next)
    setInput('')
    setLoading(true)
    setError('')
    try {
      const reply = await coachReply({ key: settings.geminiKey, model: settings.geminiModel }, context, next)
      setHistory([...next, { role: 'model', text: reply.trim() }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The coach could not answer. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between py-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Coach</h1>
        {view === 'chat' && history.length > 0 && (
          <button className="text-sm font-medium text-accent" onClick={() => setHistory([])}>
            New chat
          </button>
        )}
      </div>

      {!settings.geminiKey ? (
        <div className="rounded-[20px] bg-surface p-4">
          <h2 className="mb-2 font-display text-lg font-semibold">Your free AI diet coach</h2>
          <p className="mb-3 text-muted">It plans your meals for the week and answers your food questions.</p>
          <AiKeySetup />
        </div>
      ) : (
        <>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'plan', label: 'Meal plan' },
              { value: 'chat', label: 'Chat' },
            ]}
          />
        </>
      )}
      {settings.geminiKey && view === 'plan' && <MealPlanView />}
      {settings.geminiKey && view === 'chat' && (
        <>
          {history.length === 0 && (
            <div className="space-y-2">
              <p className="text-muted">
                Ask anything about food and losing weight. The coach knows your goal and today’s log ({kcal(day.totals.kcal)} kcal so far).
              </p>
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left">
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {history.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : ''}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[20px] px-4 py-2.5 ${
                    t.role === 'user' ? 'rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md bg-surface'
                  }`}
                >
                  {t.role === 'model' ? <Formatted text={t.text} /> : t.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex">
                <div className="flex gap-1 rounded-[20px] rounded-bl-md bg-surface px-4 py-3.5" aria-label="Coach is typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            <div ref={endRef} />
          </div>
          <form
            className="sticky bottom-24 flex gap-2 rounded-[20px] bg-bg/90 py-2 backdrop-blur"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input className="field" placeholder="Ask the coach" value={input} onChange={(e) => setInput(e.target.value)} enterKeyHint="send" />
            <button className="btn btn-primary shrink-0 px-4" disabled={!input.trim() || loading} aria-label="Send">
              <Icon name="right" />
            </button>
          </form>
        </>
      )}
    </div>
  )
}

/** Renders the coach's plain text, turning **bold** into <strong>. */
function Formatted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
      )}
    </>
  )
}
