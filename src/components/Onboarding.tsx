import { useState } from 'react'
import { ACTIVITY, bmi, caloriePlan, macroTargets, weeksToGoal } from '../lib/calc'
import { addDays, dateKey, parseKey } from '../lib/date'
import { num } from '../lib/format'
import { useStore } from '../lib/store'
import type { Activity, Profile, Sex } from '../lib/types'
import { Field, Logo, Segmented } from './ui'
import { PlateView } from './ThreeViews'
import { locale, t } from '../lib/i18n'

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
      <Field label={t('Sex')}>
        <Segmented
          value={sex}
          onChange={setSex}
          options={[
            { value: 'female', label: t('Female') },
            { value: 'male', label: t('Male') },
          ]}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('Age')}>
          <input className="field num" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" />
        </Field>
        <Field label={t('Height, cm')}>
          <input className="field num" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
        </Field>
        <Field label={t('Weight, kg')}>
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
            <div className="font-semibold">{t(ACTIVITY[a].label)}</div>
            <div className="text-sm text-muted">{t(ACTIVITY[a].detail)}</div>
          </button>
        ))}
      </div>
      <NextButton onClick={() => setStep(3)} />
    </div>,
    <div key="3" className="space-y-5">
      <Title text="Your goal" sub="Pick a weight you'd be happy with. You can change it any time." />
      <Field label={t('Goal weight, kg')}>
        <input className="field num text-2xl" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={weightN ? String(Math.round(weightN * 0.9)) : '70'} />
      </Field>
      {goalN > 0 && goalN < weightN && (
        <Field label={t('Lose per week')}>
          <div className="grid grid-cols-2 gap-2">
            {PACES.map((p) => (
              <button
                key={p.value}
                onClick={() => setPace(p.value)}
                aria-pressed={pace === p.value}
                className={`rounded-2xl border p-3 text-left ${pace === p.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
              >
                <div className="num text-lg font-semibold">{p.label}</div>
                <div className="text-xs text-muted">{t(p.detail)}</div>
              </button>
            ))}
          </div>
        </Field>
      )}
      {goalN > 0 && goalN >= weightN && <p className="text-sm text-muted">{t('Your goal isn\'t below your current weight, so Plate will aim to keep your weight steady.')}</p>}
      <NextButton disabled={!step3Ok} onClick={() => setStep(4)} label={t('See my plan')} />
    </div>,
    <Result key="4" profile={profile} weight={weightN} macroPreset={macroPreset} onFinish={finish} editing={editing} />,
  ]

  return (
    <div className="safe-top safe-bottom mx-auto min-h-dvh max-w-lg px-5">
      {step > (editing ? 1 : 0) && (
        <button onClick={() => setStep(step - 1)} className="mb-2 mt-1 text-accent font-medium">
          {t('Back')}
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
  const language = useStore((s) => s.settings.language)
  const updateSettings = useStore((s) => s.updateSettings)
  return (
    <div className="flex min-h-[88dvh] flex-col">
      <div className="flex items-center justify-between pt-1">
        <span className="flex items-center gap-2 font-display text-xl font-bold">
          <Logo className="h-10 w-10" /> Plate
        </span>
        <LanguageSwitch value={language} onChange={(language) => updateSettings({ language })} />
      </div>
      <div className="relative mx-auto mt-2 h-[300px] w-full max-w-[340px]">
        <div className="pointer-events-none absolute inset-x-8 bottom-8 top-16 rounded-full bg-[radial-gradient(circle,rgb(69_240_160/0.28),transparent_70%)] blur-2xl" />
        <PlateView />
      </div>
      <div className="mt-auto pb-6">
        <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight">
          {t('Eat well,')}
          <br />
          <span className="glow-text text-accent">{t('weigh less.')}</span>
        </h1>
        <p className="mt-4 max-w-sm text-lg text-muted">{t('Log meals by search, barcode or photo. Plate counts the calories and keeps you on pace for your goal.')}</p>
        <button className="btn btn-primary mt-10 w-full text-lg" onClick={onNext}>
          {t('Set up my plan')}
        </button>
        <p className="mt-3 text-center text-xs text-muted">{t('Free. Your data stays on this phone.')}</p>
      </div>
    </div>
  )
}

export function LanguageSwitch({ value, onChange }: { value: 'en' | 'ka'; onChange: (v: 'en' | 'ka') => void }) {
  return (
    <div className="glass flex rounded-full p-1 text-sm font-semibold" role="radiogroup" aria-label={t('Language / ენა')}>
      {(
        [
          ['en', 'English'],
          ['ka', 'ქართული'],
        ] as const
      ).map(([code, label]) => (
        <button
          key={code}
          role="radio"
          aria-checked={value === code}
          onClick={() => onChange(code)}
          className={`rounded-full px-3 py-1.5 ${value === code ? 'bg-accent text-accent-ink' : 'text-muted'}`}
        >
          {label}
        </button>
      ))}
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
  const goalDate = weeks ? parseKey(addDays(dateKey(), weeks * 7)).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) : null
  const b = bmi(weight, profile.heightCm)

  return (
    <div className="space-y-5">
      <Title text="Your daily target" />
      <div className="rounded-[24px] bg-accent p-6 text-accent-ink">
        <div className="num text-7xl font-bold leading-none tracking-tight">{plan.target.toLocaleString()}</div>
        <div className="mt-2 text-lg opacity-90">{t('calories a day')}</div>
        {goalDate && (
          <p className="mt-5 border-t border-current/20 pt-4 opacity-95">
            {t('At {rate} kg a week you’d reach {goal} kg around', { rate: profile.ratePerWeekKg, goal: profile.goalWeightKg })} <strong>{goalDate}</strong>.
          </p>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label={t('Burn at rest')} value={plan.bmr} />
        <Stat label={t('Burn per day')} value={plan.maintenance} />
        <Stat label={t('Daily deficit')} value={plan.deficit} />
      </dl>
      <div className="rounded-2xl bg-surface p-4 text-sm">
        <div className="mb-2 font-semibold">{t('Daily nutrients')}</div>
        <div className="flex justify-between">
          <span>
            <span className="num font-semibold text-protein">{macros.protein} g</span> {t('protein')}
          </span>
          <span>
            <span className="num font-semibold text-carbs">{macros.carbs} g</span> {t('carbs')}
          </span>
          <span>
            <span className="num font-semibold text-fat">{macros.fat} g</span> {t('fat')}
          </span>
        </div>
      </div>
      {plan.floored && (
        <p className="text-sm text-muted">
          {t('That pace would put you below {n} calories, the lowest safe target without medical supervision, so Plate held it there. Progress will be a little slower.', { n: plan.target.toLocaleString() })}
        </p>
      )}
      <p className="text-sm text-muted">
        {t('BMI {bmi}. These numbers are estimates; check with a doctor before big diet changes.', { bmi: b.toFixed(1) })}
      </p>
      <button className="btn btn-primary w-full text-lg" onClick={onFinish}>
        {editing ? t('Save plan') : t('Start tracking')}
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
      <h1 className="font-display text-3xl font-bold tracking-tight">{t(text)}</h1>
      {sub && <p className="mt-1 text-muted">{t(sub)}</p>}
    </div>
  )
}

function NextButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button className="btn btn-primary mt-4 w-full text-lg" disabled={disabled} onClick={onClick}>
      {label ?? t('Continue')}
    </button>
  )
}
