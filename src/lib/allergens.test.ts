import { describe, expect, it } from 'vitest'
import { allergensFromTags, dietStatus, dietWarnings } from './allergens'

describe('allergens', () => {
  it('reads the allergens Plate knows from Open Food Facts tags', () => {
    expect(allergensFromTags(['en:milk', 'en:sesame-seeds', 'en:something-else', 'en:gluten'])).toEqual(['gluten', 'milk', 'sesame'])
    expect(allergensFromTags(undefined)).toEqual([])
  })

  it('reads vegan and vegetarian status', () => {
    const tags = ['en:palm-oil-free', 'en:non-vegan', 'en:maybe-vegetarian']
    expect(dietStatus(tags, 'vegan')).toBe('no')
    expect(dietStatus(tags, 'vegetarian')).toBe('maybe')
    expect(dietStatus(['en:vegan-status-unknown'], 'vegan')).toBeUndefined()
  })
})

describe('diet warnings', () => {
  const product = { allergens: ['milk', 'soy'] as const, traces: ['nuts', 'milk'] as const, vegan: 'no' as const, vegetarian: 'yes' as const }
  const health = { ...product, allergens: [...product.allergens], traces: [...product.traces] }

  it('lists only the person’s allergens, without repeating traces already contained', () => {
    expect(dietWarnings(health, ['milk', 'nuts', 'eggs'], 'any')).toEqual({ contains: ['milk'], traces: ['nuts'], diet: undefined })
    expect(dietWarnings(health, ['eggs'], 'any')).toEqual({ contains: [], traces: [], diet: undefined })
  })

  it('checks the diet', () => {
    expect(dietWarnings(health, [], 'vegan').diet).toBe('Not vegan')
    expect(dietWarnings(health, [], 'vegetarian').diet).toBeUndefined()
    expect(dietWarnings({ vegetarian: 'maybe' }, [], 'vegetarian').diet).toBe('May not be vegetarian')
  })

  it('warns pescatarians about likely meat but not fish', () => {
    expect(dietWarnings({ vegetarian: 'no', allergens: [] }, [], 'pescatarian').diet).toBe('May contain meat')
    expect(dietWarnings({ vegetarian: 'no', allergens: ['fish'] }, [], 'pescatarian').diet).toBeUndefined()
  })

  it('has nothing to say without data', () => {
    expect(dietWarnings(undefined, ['milk'], 'vegan')).toEqual({ contains: [], traces: [], diet: undefined })
  })
})
