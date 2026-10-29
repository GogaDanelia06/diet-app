import { describe, expect, it } from 'vitest'
import { pickModel } from './ai'

describe('choosing a Gemini model for a key', () => {
  const listed = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.8-flash-image', 'gemini-flash-latest', 'text-embedding-004']

  it('keeps the chosen model when the key can use it', () => {
    expect(pickModel(listed, 'gemini-3.6-flash')).toBe('gemini-3.6-flash')
  })

  it('otherwise takes the newest stable Flash model', () => {
    expect(pickModel(listed, 'gemini-9-flash')).toBe('gemini-3.8-flash')
    expect(pickModel(['gemini-flash-latest', 'gemini-3.5-flash-lite'], 'gemini-9-flash')).toBe('gemini-flash-latest')
  })

  it('leaves the choice alone when nothing suitable is listed', () => {
    expect(pickModel([], 'gemini-3.8-flash')).toBe('gemini-3.8-flash')
  })
})
