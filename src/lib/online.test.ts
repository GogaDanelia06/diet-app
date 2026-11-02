import { describe, expect, it } from 'vitest'
import { parseAlternatives, usdaKeys } from './online'

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
