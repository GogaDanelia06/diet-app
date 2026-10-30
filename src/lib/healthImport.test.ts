import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyHealthText, healthTextFromHash } from './healthImport'
import { useStore } from './store'

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

describe('Health numbers from the Plate shortcut', () => {
  beforeEach(() => useStore.setState({ deviceActivity: {}, steps: {}, weights: [] }))

  it('reads the text from the link the shortcut opens', () => {
    expect(healthTextFromHash('#health=plate%20date%3D2026-10-30%20active%3D512%20steps%3D8%2C412')).toBe('plate date=2026-10-30 active=512 steps=8,412')
    expect(healthTextFromHash('#health=plate+steps%3D500')).toBe('plate steps=500')
    expect(healthTextFromHash('#other=1')).toBeNull()
    expect(healthTextFromHash('#health=%E0%A4%A')).toBeNull()
  })

  it('saves steps, watch calories and weight for the day in the text', () => {
    const r = applyHealthText('plate date=2026-10-30 active=512 steps=8412 weight=88.9 kg', '2026-10-31')
    expect(r?.day).toBe('2026-10-30')
    const st = useStore.getState()
    expect(st.deviceActivity['2026-10-30']).toMatchObject({ activeKcal: 512, steps: 8412, source: 'health' })
    expect(st.weights).toEqual([{ date: '2026-10-30', kg: 88.9 }])
  })

  it('keeps saved watch calories when only steps arrive', () => {
    applyHealthText('plate date=2026-10-30 active=512 steps=8412', '2026-10-30')
    applyHealthText('plate date=2026-10-30 steps=9000', '2026-10-30')
    expect(useStore.getState().deviceActivity['2026-10-30']).toMatchObject({ activeKcal: 512, steps: 9000 })
    expect(applyHealthText('shopping list', '2026-10-30')).toBeNull()
  })
})
