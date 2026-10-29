import { afterEach, describe, expect, it } from 'vitest'
import { setLang, t, tName, tServing } from './i18n'
import { BUILTIN_FOODS } from './foods'
import { searchFoods } from './search'

afterEach(() => setLang('en'))

describe('Georgian', () => {
  it('translates and fills in placeholders', () => {
    setLang('ka')
    expect(t('Today')).toBe('დღეს')
    expect(t('Add {n} kcal', { n: 383 })).toBe('383 კკალ-ის დამატება')
    expect(t('Not translated yet')).toBe('Not translated yet')
    setLang('en')
    expect(t('Add {n} kcal', { n: 383 })).toBe('Add 383 kcal')
  })

  it('names built-in foods and serving sizes', () => {
    setLang('ka')
    expect(tName('Khinkali, meat')).toBe('ხინკალი, ხორცის')
    expect(tName('My own soup')).toBe('My own soup')
    expect(tServing('1 slice (1/6)')).toBe('1 ნაჭერი (1/6)')
  })

  it('finds foods by their Georgian name in either language', () => {
    expect(searchFoods(BUILTIN_FOODS, 'ხაჭაპური')[0].name).toMatch(/Khachapuri/)
    expect(searchFoods(BUILTIN_FOODS, 'მწვადი')[0].name).toMatch(/Mtsvadi/)
  })
})
