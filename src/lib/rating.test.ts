import { describe, expect, it } from 'vitest'
import { healthFromOff, rateFood } from './rating'

describe('Open Food Facts health fields', () => {
  it('reads Nutri-Score, NOVA group, nutrient levels and additives', () => {
    expect(
      healthFromOff({
        nutriscore_grade: 'E',
        nova_group: '4',
        nutrient_levels: { fat: 'high', 'saturated-fat': 'high', sugars: 'high', salt: 'low' },
        additives_n: 1,
      }),
    ).toEqual({
      nutriScore: 'e',
      nova: 4,
      levels: { fat: 'high', saturatedFat: 'high', sugars: 'high', salt: 'low' },
      additives: 1,
    })
  })

  it('leaves out what the product doesn’t have', () => {
    expect(healthFromOff({ nutriscore_grade: 'unknown', nutrient_levels: {}, additives_n: null })).toEqual({})
    expect(healthFromOff({ nutriscore_grade: 'not-applicable', nova_group: 7, nutrient_levels: { sugars: 'lots' } })).toEqual({})
    expect(healthFromOff({ additives_n: 0 })).toEqual({ additives: 0 })
  })
})

describe('rating a product', () => {
  it('follows the Nutri-Score', () => {
    expect(rateFood({ nutriScore: 'a' })).toBe('good')
    expect(rateFood({ nutriScore: 'b' })).toBe('good')
    expect(rateFood({ nutriScore: 'c' })).toBe('okay')
    expect(rateFood({ nutriScore: 'd' })).toBe('limit')
    expect(rateFood({ nutriScore: 'e' })).toBe('limit')
  })

  it('never calls ultra-processed food a good choice', () => {
    expect(rateFood({ nutriScore: 'a', nova: 4 })).toBe('okay')
    expect(rateFood({ nutriScore: 'e', nova: 4 })).toBe('limit')
    expect(rateFood({ nutriScore: 'a', nova: 1 })).toBe('good')
  })

  it('uses sugar, fat and salt when there is no Nutri-Score', () => {
    expect(rateFood({ levels: { sugars: 'high', salt: 'high', fat: 'low' } })).toBe('limit')
    expect(rateFood({ levels: { sugars: 'high', salt: 'low', fat: 'low' } })).toBe('okay')
    expect(rateFood({ levels: { sugars: 'low', salt: 'low', fat: 'moderate' } })).toBe('good')
    expect(rateFood({ levels: { sugars: 'low', salt: 'low' }, nova: 4 })).toBe('okay')
    expect(rateFood({ levels: { sugars: 'moderate' } })).toBe('okay')
  })

  it('gives no rating without data', () => {
    expect(rateFood(undefined)).toBeNull()
    expect(rateFood({})).toBeNull()
    expect(rateFood({ nova: 1, additives: 0 })).toBeNull()
  })
})
