import { useEffect, useRef, useState } from 'react'
import { readNutritionLabel } from '../lib/ai'
import { uid } from '../lib/date'
import { num } from '../lib/format'
import { photoToJpegBase64 } from '../lib/image'
import { useStore } from '../lib/store'
import type { Food } from '../lib/types'
import { ErrorNote, Field, Icon, Segmented, Sheet, Spinner } from './ui'

type Basis = '100' | 'serving'

export default function FoodEditor({
  food,
  barcode,
  startWithLabelScan = false,
  onClose,
  onSaved,
}: {
  food?: Food
  barcode?: string
  startWithLabelScan?: boolean
  onClose: () => void
  onSaved?: (f: Food) => void
}) {
  const settings = useStore((s) => s.settings)
  const saveCustomFood = useStore((s) => s.saveCustomFood)
  const removeCustomFood = useStore((s) => s.removeCustomFood)
  const serving = food?.servings[0]
  const [name, setName] = useState(food?.name ?? '')
  const [brand, setBrand] = useState(food?.brand ?? '')
  const [servingLabel, setServingLabel] = useState(serving?.label ?? '1 serving')
  const [servingGrams, setServingGrams] = useState(serving ? String(serving.grams) : '')
  const [basis, setBasis] = useState<Basis>('100')
  const [vals, setVals] = useState({
    kcal: food ? String(food.per100.kcal) : '',
    protein: food ? String(food.per100.protein) : '',
    carbs: food ? String(food.per100.carbs) : '',
    fat: food ? String(food.per100.fat) : '',
    fiber: food?.per100.fiber != null ? String(food.per100.fiber) : '',
    sugar: food?.per100.sugar != null ? String(food.per100.sugar) : '',
  })
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (startWithLabelScan && settings.geminiKey) fileRef.current?.click()
  }, [startWithLabelScan, settings.geminiKey])

  const sg = num(servingGrams)
  const factor = basis === 'serving' ? (sg > 0 ? 100 / sg : 0) : 1
  const canSave = name.trim() && num(vals.kcal) >= 0 && vals.kcal !== '' && (basis === '100' || sg > 0)

  async function scanLabel(file: File) {
    setScanning(true)
    setError('')
    try {
      const { base64 } = await photoToJpegBase64(file, 1600)
      const r = await readNutritionLabel({ key: settings.geminiKey, model: settings.geminiModel }, base64)
      if (!name) setName(r.name)
      if (!brand && r.brand) setBrand(r.brand)
      if (r.servingGrams) setServingGrams(String(r.servingGrams))
      setBasis('100')
      const s = (n?: number) => (n == null ? '' : String(Math.round(n * 10) / 10))
      setVals({ kcal: s(r.per100.kcal), protein: s(r.per100.protein), carbs: s(r.per100.carbs), fat: s(r.per100.fat), fiber: s(r.per100.fiber), sugar: s(r.per100.sugar) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the label.')
    } finally {
      setScanning(false)
    }
  }

  function save() {
    const v = (s: string) => Math.round(num(s) * factor * 10) / 10
    const f: Food = {
      id: food?.id ?? `c-${uid()}`,
      name: name.trim(),
      brand: brand.trim() || undefined,
      category: 'My foods',
      barcode: food?.barcode ?? barcode,
      per100: {
        kcal: Math.round(num(vals.kcal) * factor),
        protein: v(vals.protein),
        carbs: v(vals.carbs),
        fat: v(vals.fat),
        fiber: vals.fiber ? v(vals.fiber) : undefined,
        sugar: vals.sugar ? v(vals.sugar) : undefined,
      },
      servings: sg > 0 ? [{ label: servingLabel.trim() || '1 serving', grams: sg }] : [],
      source: 'custom',
    }
    saveCustomFood(f)
    onSaved?.(f)
    onClose()
  }

  const set = (k: keyof typeof vals) => (e: React.ChangeEvent<HTMLInputElement>) => setVals({ ...vals, [k]: e.target.value })

  return (
    <Sheet
      title={food ? 'Edit food' : 'New food'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {food && (
            <button
              className="btn btn-quiet text-over"
              onClick={() => {
                removeCustomFood(food.id)
                onClose()
              }}
            >
              Delete
            </button>
          )}
          <button className="btn btn-primary flex-1 text-lg" disabled={!canSave} onClick={save}>
            Save food
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {settings.geminiKey ? (
          <label className="btn btn-quiet w-full cursor-pointer">
            <Icon name="camera" className="h-5 w-5 text-accent" /> Fill in from a label photo
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && scanLabel(e.target.files[0])} />
          </label>
        ) : (
          <p className="text-sm text-muted">Tip: add a free AI key in Me to fill this in from a photo of the label.</p>
        )}
        {scanning && <Spinner label="Reading the label…" />}
        {error && <ErrorNote>{error}</ErrorNote>}
        {barcode && <p className="text-sm text-muted">Barcode {barcode}</p>}

        <Field label="Name">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grandma’s lobio" />
        </Field>
        <Field label="Brand (optional)">
          <input className="field" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Serving name">
            <input className="field" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} />
          </Field>
          <Field label="Serving size, g">
            <input className="field num" inputMode="decimal" value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} placeholder="optional" />
          </Field>
        </div>
        <Field label="The numbers below are for">
          <Segmented
            value={basis}
            onChange={setBasis}
            options={[
              { value: '100', label: '100 g' },
              { value: 'serving', label: 'One serving' },
            ]}
          />
        </Field>
        <Field label="Calories">
          <input className="field num text-2xl" inputMode="decimal" value={vals.kcal} onChange={set('kcal')} placeholder="0" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Protein, g">
            <input className="field num" inputMode="decimal" value={vals.protein} onChange={set('protein')} />
          </Field>
          <Field label="Carbs, g">
            <input className="field num" inputMode="decimal" value={vals.carbs} onChange={set('carbs')} />
          </Field>
          <Field label="Fat, g">
            <input className="field num" inputMode="decimal" value={vals.fat} onChange={set('fat')} />
          </Field>
          <Field label="Fiber, g">
            <input className="field num" inputMode="decimal" value={vals.fiber} onChange={set('fiber')} />
          </Field>
          <Field label="Sugar, g">
            <input className="field num" inputMode="decimal" value={vals.sugar} onChange={set('sugar')} />
          </Field>
        </div>
      </div>
    </Sheet>
  )
}
