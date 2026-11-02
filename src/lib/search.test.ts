import { describe, expect, it } from 'vitest'
import { BUILTIN_FOODS } from './foods'
import { searchFoods } from './search'

const names = (query: string) => searchFoods(BUILTIN_FOODS, query).map((f) => (f.brand ? `${f.brand}: ${f.name}` : f.name))

describe('food search', () => {
  it('finds Mac Shaurma by its name in Latin letters or Georgian', () => {
    for (const query of ['mac shaurma', 'macshaurma', 'მაკ შაურმა', 'mac shawarma'])
      expect(names(query).slice(0, 2).sort(), query).toEqual(['Mac Shaurma: Chicken shaurma', 'Mac Shaurma: Pork shaurma'])
  })

  it('treats the usual spellings of shawarma and other dishes as the same word', () => {
    for (const query of ['shaurma', 'shawarma', 'shaverma', 'შაურმა']) {
      expect(names(query), query).toContain('Chicken shawarma wrap')
      expect(names(query), query).toContain('Mac Shaurma: Chicken shaurma')
    }
    expect(names('xachapuri adjaruli')).toContain('Khachapuri Adjaruli')
    expect(names('hinkali')).toContain('Khinkali, meat')
  })

  it('doesn’t widen short, partly typed words', () => {
    expect(names('chi').some((n) => n.startsWith('Khinkali'))).toBe(false)
  })
})
