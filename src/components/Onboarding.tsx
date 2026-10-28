import { useState } from 'react'
import { ACTIVITY, bmi, caloriePlan, macroTargets, weeksToGoal } from '../lib/calc'
import { addDays, dateKey, parseKey } from '../lib/date'
import { num } from '../lib/format'
import { useStore } from '../lib/store'
import type { Activity, Profile, Sex } from '../lib/types'
import { Field, Segmented } from './ui'

const PACES = [
  { value: 0.25, label: '0.25 kg', detail: 'Gentle' },
  { value: 0.5, label: '0.5 kg', detail: 'Steady, recommended' },
  { value: 0.75, label: '0.75 kg', detail: 'Faster' },
  { value: 1, label: '1 kg', detail: 'Hard to keep up' },
]

export default function Onboarding({ onDone, editing = false }: { onDone: () => void; editing?: boolean }) {
  const existing = useStore((s) => s.profile)
  const weights = useStore((s) => s.weights)
  const setProfile = useStore((s) => s.setProfile)
  const logWeight = useStore((s) => s.logWeight)
  const macroPreset = useStore((s) => s.settings.macroPreset)
  const latest = weights.at(-1)?.kg ?? existing?.startWeightKg

  const [step, setStep] = useState(editing ? 1 : 0)
  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'female')
  const [age, setAge] = useState(String(existing?.age ?? ''))
  const [height, setHeight] = useState(String(existing?.heightCm ?? ''))
  const [weight, setWeight] = useState(latest ? String(latest) : '')
  const [goal, setGoal] = useState(String(existing?.goalWeightKg ?? ''))
  const [activity, setActivity] = useState<Activity>(existing?.activity ?? 'light')
  const [pace, setPace] = useState(existing?.ratePerWeekKg || 0.5)

  const ageN = num(age)
  const heightN = num(height)
  const weightN = num(weight)
  const goalN = num(goal)
  const step1Ok = ageN >= 14 && ageN <= 100 && heightN >= 120 && heightN <= 230 && weightN >= 35 && weightN <= 300
  const step3Ok = goalN >= 35 && goalN <= 300

  const profile: Profile = {
    sex,
    age: ageN,
    heightCm: heightN,
    startWeightKg: editing && existing ? existing.startWeightKg : weightN,
    goalWeightKg: goalN,
    activity,
    ratePerWeekKg: goalN < weightN ? pace : 0,
    startDate: editing && existing ? existing.startDate : dateKey(),
  }

  function finish() {
    setProfile(profile)
    if (!latest || Math.abs(latest - weightN) > 0.01) logWeight(dateKey(), weightN)
    onDone()
  }

  const steps = [
    <Welcome key="w" onNext={() => setStep(1)} />,
    <div key="1" className="space-y-5">
      <Title text="About you" sub="Used to work out how many calories your body burns." />
      <Field label="Sex">
        <Segmented
          value={sex}
          onChange={setSex}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
          ]}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Age">
          <input className="field num" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" />
        </Field>
        <Field label="Height, cm">
          <input className="field num" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
        </Field>
        <Field label="Weight, kg">
          <input className="field num" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="80" />
        </Field>
      </div>
      <NextButton disabled={!step1Ok} onClick={() => setStep(2)} />
    </div>,
    <div key="2" className="space-y-4">
      <Title text="How active are you?" sub="Think of a normal week, not your best one." />
      <div className="space-y-2">
        {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
          <button
            key={a}
            onClick={() => setActivity(a)}
            aria-pressed={activity === a}
            className={`w-full rounded-2xl border p-3.5 text-left ${
              activity === a ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
            }`}
          >
            <div className="font-semibold">{ACTIVITY[a].label}</div>
            <div className="text-sm text-muted">{ACTIVITY[a].detail}</div>
          </button>
        ))}
      </div>
      <NextButton onClick={() => setStep(3)} />
    </div>,
    <div key="3" className="space-y-5">
      <Title text="Your goal" sub="Pick a weight you'd be happy with. You can change it any time." />
      <Field label="Goal weight, kg">
        <input className="field num text-2xl" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={weightN ? String(Math.round(weightN * 0.9)) : '70'} />
      </Field>
      {goalN > 0 && goalN < weightN && (
        <Field label="Lose per week">
          <div className="grid grid-cols-2 gap-2">
            {PACES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPace(p.value)}
                aria-pressed={pace === p.value}
                className={`rounded-2xl border p-3 text-left ${pace === p.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
              >
                <div className="num text-lg font-semibold">{p.label}</div>
                <div className="text-xs text-muted">{p.detail}</div>
              </button>
            ))}
          </div>
        </Field>
      )}
      {goalN > 0 && goalN >= weightN && <p className="text-sm text-muted">Your goal isn't below your current weight, so Plate will aim to keep your weight steady.</p>}
      <NextButton disabled={!step3Ok} onClick={() => setStep(4)} label="See my plan" />
    </div>,
    <Result key="4" profile={profile} weight={weightN} macroPreset={macroPreset} onFinish={finish} editing={editing} />,
  ]

  return (
    <div className="safe-top safe-bottom mx-auto min-h-dvh max-w-lg px-5">
      {step > (editing ? 1 : 0) && (
        <button onClick={() => setStep(step - 1)} className="mb-2 mt-1 text-accent font-medium">
          Back
        </button>
      )}
      {step > 0 && (
        <div className="mb-6 mt-2 flex gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </div>
      )}
      {steps[step]}
    </div>
  )
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex min-h-[85dvh] flex-col justify-end pb-6">
      <svg viewBox="0 0 120 120" className="mb-8 h-28 w-28" aria-hidden="true">
        <circle cx="60" cy="60" r="46" fill="none" stroke="var(--line)" strokeWidth="12" />
        <path d="M60 14 A46 46 0 1 1 18 79" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" />
        <path d="M18 79 A46 46 0 0 1 14 60" fill="none" stroke="var(--protein)" strokeWidth="12" strokeLinecap="round" />
      </svg>
      <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight">
        Eat well,
        <br />
        weigh less.
      </h1>
      <p className="mt-4 max-w-sm text-lg text-muted">
        Log meals by search, barcode or photo. Plate counts the calories and keeps you on pace for your goal.
      </p>
      <button className="btn btn-primary mt-10 w-full text-lg" onClick={onNext}>
        Set up my plan
      </button>
      <p className="mt-3 text-center text-xs text-muted">Free. Your data stays on this phone.</p>
    </div>
  )
}

function Result({
  profile,
  weight,
  macroPreset,
  onFinish,
  editing,
}: {
  profile: Profile
  weight: number
  macroPreset: Parameters<typeof macroTargets>[1]
  onFinish: () => void
  editing: boolean
}) {
  const plan = caloriePlan(profile, weight)
  const macros = macroTargets(plan.target, macroPreset)
  const weeks = weeksToGoal(weight, profile.goalWeightKg, profile.ratePerWeekKg)
  const goalDate = weeks ? parseKey(addDays(dateKey(), weeks * 7)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null
  const b = bmi(weight, profile.heightCm)

  return (
    <div className="space-y-5">
      <Title text="Your daily target" />
      <div className="rounded-[24px] bg-accent p-6 text-accent-ink">
        <div className="num text-7xl font-bold leading-none tracking-tight">{plan.target.toLocaleString()}</div>
        <div className="mt-2 text-lg opacity-90">calories a day</div>
        {goalDate && (
          <p className="mt-5 border-t border-current/20 pt-4 opacity-95">
            At {profile.ratePerWeekKg} kg a week you'd reach {profile.goalWeightKg} kg around <strong>{goalDate}</strong>.
          </p>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Burn at rest" value={plan.bmr} />
        <Stat label="Burn per day" value={plan.maintenance} />
        <Stat label="Daily deficit" value={plan.deficit} />
      </dl>
      <div className="rounded-2xl bg-surface p-4 text-sm">
        <div className="mb-2 font-semibold">Daily nutrients</div>
        <div className="flex justify-between">
          <span>
            <span className="num font-semibold text-protein">{macros.protein} g</span> protein
          </span>
          <span>
            <span className="num font-semibold text-carbs">{macros.carbs} g</span> carbs
          </span>
          <span>
            <span className="num font-semibold text-fat">{macros.fat} g</span> fat
          </span>
        </div>
      </div>
      {plan.floored && (
        <p className="text-sm text-muted">
          That pace would put you below {plan.target.toLocaleString()} calories, the lowest safe target without medical supervision, so Plate held it there. Progress will be a little slower.
        </p>
      )}
      <p className="text-sm text-muted">
        BMI {b.toFixed(1)}. These numbers are estimates; check with a doctor before big diet changes.
      </p>
      <button className="btn btn-primary w-full text-lg" onClick={onFinish}>
        {editing ? 'Save plan' : 'Start tracking'}
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3">
      <dd className="num text-xl font-semibold">{value.toLocaleString()}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  )
}

function Title({ text, sub }: { text: string; sub?: string }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">{text}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  )
}

function NextButton({ onClick, disabled, label = 'Continue' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button className="btn btn-primary mt-4 w-full text-lg" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )
}
