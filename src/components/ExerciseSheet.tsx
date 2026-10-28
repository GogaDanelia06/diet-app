import { useState } from 'react'
import { exerciseKcal } from '../lib/calc'
import { EXERCISES } from '../lib/exercises'
import { num } from '../lib/format'
import { currentWeight, useStore } from '../lib/store'
import { Field, Sheet } from './ui'

export default function ExerciseSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const addExercise = useStore((s) => s.addExercise)
  const weight = useStore((s) => currentWeight(s))
  const [choice, setChoice] = useState(0)
  const [minutes, setMinutes] = useState('30')
  const [custom, setCustom] = useState('')
  const [customName, setCustomName] = useState('')

  const isCustom = choice === -1
  const ex = EXERCISES[choice]
  const burned = isCustom ? Math.round(num(custom)) : exerciseKcal(ex.met, weight, num(minutes))

  function save() {
    addExercise({ date, name: isCustom ? customName.trim() || 'Exercise' : ex.name, minutes: Math.round(num(minutes)), kcal: burned })
    onClose()
  }

  return (
    <Sheet
      title="Add exercise"
      onClose={onClose}
      footer={
        <button className="btn btn-primary w-full text-lg" disabled={burned <= 0} onClick={save}>
          Add {burned > 0 ? `${burned} kcal` : ''}
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="Activity">
          <select className="field" value={choice} onChange={(e) => setChoice(Number(e.target.value))}>
            {EXERCISES.map((e, i) => (
              <option key={e.name} value={i}>
                {e.name}
              </option>
            ))}
            <option value={-1}>Other (I know the calories)</option>
          </select>
        </Field>
        {isCustom && (
          <>
            <Field label="Name">
              <input className="field" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Morning workout" />
            </Field>
            <Field label="Calories burned" hint="From your watch or the machine">
              <input className="field num" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Minutes">
          <input className="field num text-2xl" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        {!isCustom && (
          <p className="text-sm text-muted">
            Estimated for your weight of {weight} kg. Watches and machines often overestimate, so a rough number is fine.
          </p>
        )}
      </div>
    </Sheet>
  )
}
