import { describe, expect, it } from 'vitest'
import { usdaKeys } from './online'

describe('USDA keys', () => {
  it('tries the person’s own key, then the shared key, then the demo key', () => {
    expect(usdaKeys(' mine ', 'shared')).toEqual(['mine', 'shared', 'DEMO_KEY'])
    expect(usdaKeys('', 'shared')).toEqual(['shared', 'DEMO_KEY'])
    expect(usdaKeys('', '')).toEqual(['DEMO_KEY'])
    expect(usdaKeys('same', 'same')).toEqual(['same', 'DEMO_KEY'])
  })
})
