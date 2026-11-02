import { describe, expect, it } from 'vitest'
import { chainQuery, fromUsda, parseAlternatives, splitChain, usdaKeys } from './online'

describe('USDA keys', () => {
  it('tries the person’s own key, then the shared key, then the demo key', () => {
    expect(usdaKeys(' mine ', 'shared')).toEqual(['mine', 'shared', 'DEMO_KEY'])
    expect(usdaKeys('', 'shared')).toEqual(['shared', 'DEMO_KEY'])
    expect(usdaKeys('', '')).toEqual(['DEMO_KEY'])
    expect(usdaKeys('same', 'same')).toEqual(['same', 'DEMO_KEY'])
  })
})

describe('better alternatives', () => {
  it('keeps named products with the asked grade, leaving out the scanned one', () => {
    const data = {
      products: [
        { code: '111', product_name: 'Oat spread', brands: 'Good Co, Other', nutriscore_grade: 'a', image_front_small_url: 'https://images.example/1.jpg' },
        { code: '222', product_name: 'Scanned', nutriscore_grade: 'a' },
        { code: '333', product_name: '', product_name_en: 'Nut butter', nutriscore_grade: 'a', image_front_small_url: 'http://insecure/2.jpg' },
        { code: '444', product_name: 'Wrong grade', nutriscore_grade: 'c' },
        { code: '', product_name: 'No code', nutriscore_grade: 'a' },
      ],
    }
    expect(parseAlternatives(data, 'a', '222')).toEqual([
      { code: '111', name: 'Oat spread', brand: 'Good Co', nutriScore: 'a', image: 'https://images.example/1.jpg' },
      { code: '333', name: 'Nut butter', brand: undefined, nutriScore: 'a', image: undefined },
    ])
    expect(parseAlternatives({ error: 'busy' }, 'a')).toEqual([])
  })
})

describe('restaurant chains', () => {
  it('swaps a typed chain name for USDA’s spelling', () => {
    expect(chainQuery('mcdonalds big mac')).toEqual({ query: "McDONALD'S big mac", brand: "McDonald's" })
    expect(chainQuery("McDonald's fries")).toEqual({ query: "McDONALD'S fries", brand: "McDonald's" })
    expect(chainQuery('მაკდონალდსი')?.brand).toBe("McDonald's")
    expect(chainQuery('KFC wings')).toEqual({ query: 'KFC wings', brand: 'KFC' })
    expect(chainQuery('burger king whopper')?.query).toBe('BURGER KING whopper')
  })

  it('leaves other searches alone, Mac Shaurma included', () => {
    expect(chainQuery('mac shaurma')).toBeNull()
    expect(chainQuery('banana')).toBeNull()
  })

  it('splits USDA’s chain items into brand and name', () => {
    expect(splitChain("McDONALD'S, BIG MAC")).toEqual({ brand: "McDonald's", name: 'Big Mac' })
    expect(splitChain('KFC, Fried Chicken, ORIGINAL RECIPE, Breast, meat and skin with breading')).toEqual({ brand: 'KFC', name: 'Fried Chicken, ORIGINAL RECIPE, Breast, meat and skin with breading' })
    expect(splitChain('DOMINO\'S 14" Cheese Pizza, Classic Hand-Tossed Crust')?.brand).toBe("Domino's")
    expect(splitChain('Apples, raw, with skin')).toBeNull()
  })
})

describe('USDA foods', () => {
  it('turns a chain item into a branded food with its standard portions', () => {
    const food = fromUsda({
      fdcId: 170720,
      description: "McDONALD'S, BIG MAC",
      foodNutrients: [{ nutrientId: 1008, value: 257 }, { nutrientId: 1003, value: 11.8 }, { nutrientId: 1004, value: 15 }, { nutrientId: 1005, value: 20 }],
      foodMeasures: [
        { disseminationText: 'Quantity not specified', gramWeight: 219, rank: 1 },
        { disseminationText: '1 item', gramWeight: 219, rank: 2 },
        { disseminationText: '1 oz', gramWeight: 28.35, rank: 3 },
      ],
    })
    expect(food).toMatchObject({ name: 'Big Mac', brand: "McDonald's", source: 'usda', category: 'Fast food & chains', dataNote: { kind: 'official' } })
    expect(food.servings).toEqual([{ label: '1 item', grams: 219 }, { label: '1 oz', grams: 28.4 }])
  })

  it('keeps ordinary foods as they were', () => {
    const food = fromUsda({ fdcId: 1, description: 'APPLES, RAW', foodNutrients: [{ nutrientId: 1008, value: 52 }] })
    expect(food).toMatchObject({ name: 'Apples, Raw', brand: undefined, servings: [] })
    expect(food.dataNote).toBeUndefined()
  })
})
