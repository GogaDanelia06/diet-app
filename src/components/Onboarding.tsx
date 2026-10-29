import { useEffect, useRef, useState } from 'react'
import { ACTIVITY, bmi, caloriePlan, macroTargets, weeksToGoal } from '../lib/calc'
import { addDays, dateKey, parseKey } from '../lib/date'
import { num } from '../lib/format'
import { useStore } from '../lib/store'
import type { Activity, Profile, Sex } from '../lib/types'
import { Field, Icon, Logo, Segmented } from './ui'
import { PlateView } from './ThreeViews'
import { locale, t } from '../lib/i18n'
import './onboarding.css'

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
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (step > 0) panel.current?.querySelector('h1')?.focus({ preventScroll: true })
  }, [step])
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

  if (step === 0) return steps[0]

  return (
    <div className={`onboarding-flow safe-top safe-bottom ${editing ? 'onboarding-editing' : ''}`}>
      <aside className="onboarding-aside">
        <Brand />
        <div>
          <span className="onboarding-eyebrow">{t('Made for your everyday')}</span>
          <h2>{t('Small steps.')}<br /><span>{t('A healthier you.')}</span></h2>
          <p>{t('A plan that starts with you. Adjust it any time as your life changes.')}</p>
        </div>
        <div className="onboarding-private"><Icon name="check" /> {t('Free. Private. Yours.')}</div>
      </aside>
      <div className="onboarding-panel" ref={panel}>
        <div className="onboarding-mobile-brand"><Brand /></div>
        <div className="onboarding-step-header">
          {step > (editing ? 1 : 0) ? (
            <button onClick={() => setStep(step - 1)} className="onboarding-back"><Icon name="left" className="h-4 w-4" /> {t('Back')}</button>
          ) : <span />}
          <span>{t('Step {current} of {total}', { current: step, total: 4 })}</span>
        </div>
        <div className="onboarding-progress" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => <div key={i} className={i <= step ? 'is-complete' : ''} />)}
        </div>
        <div className="onboarding-step-content" key={step}>{steps[step]}</div>
      </div>
    </div>
  )
}

function Brand() {
  return <span className="onboarding-brand"><Logo className="h-10 w-10" /> Plate<span className="onboarding-brand-dot">.</span></span>
}

function Welcome({ onNext }: { onNext: () => void }) {
  const language = useStore((s) => s.settings.language)
  const updateSettings = useStore((s) => s.updateSettings)
  return (
    <div className="onboarding-welcome safe-top safe-bottom">
      <header className="onboarding-welcome-header">
        <Brand />
        <LanguageSwitch value={language} onChange={(language) => updateSettings({ language })} />
      </header>
      <div className="onboarding-hero">
        <div className="onboarding-hero-copy">
          <div className="onboarding-eyebrow"><span /> {t('Made for your everyday')}</div>
          <h1>{t('Eat well,')}<br /><span>{t('feel good.')}</span></h1>
          <p>{t('Your food, your progress, your pace. A little clarity for a healthier everyday.')}</p>
          <button className="btn btn-primary onboarding-start" onClick={onNext}>{t('Set up my plan')}<Icon name="right" /></button>
          <div className="onboarding-reassurance"><Icon name="check" className="h-4 w-4" /> {t('Free. Private. Yours.')}</div>
        </div>
        <div className="onboarding-visual" aria-hidden="true">
          <div className="onboarding-orbit onboarding-orbit-one" />
          <div className="onboarding-orbit onboarding-orbit-two" />
          <div className="onboarding-plate"><PlateView /></div>
          <div className="onboarding-float onboarding-float-top"><span className="onboarding-float-icon"><Icon name="book" /></span><div><strong>{t('Food you love')}</strong><span>{t('A little more balance')}</span></div><span className="onboarding-check"><Icon name="check" className="h-3 w-3" /></span></div>
          <div className="onboarding-float onboarding-float-bottom"><span className="onboarding-float-icon water"><Icon name="drop" /></span><div><strong>{t('Small steps.')}</strong><span>{t('A healthier you.')}</span></div><div className="onboarding-mini-bars"><i /><i /><i /><i /><i /></div></div>
          <span className="onboarding-visual-caption">{t('Good food. More possibilities.')}</span>
        </div>
      </div>
      <div className="onboarding-features">
        <div><Icon name="barcode" /><span>{t('Simple food logging')}</span></div>
        <div><Icon name="chart" /><span>{t('Progress you can see')}</span></div>
        <div><Icon name="globe" /><span>{t('Works offline')}</span></div>
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
      <h1 tabIndex={-1} className="font-display text-3xl font-bold tracking-tight outline-none">{t(text)}</h1>
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
