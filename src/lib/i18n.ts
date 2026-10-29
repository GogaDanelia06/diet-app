import { KA } from './i18n-ka'
import { DESIGN_KA } from './design-ka'
import { KA_NAMES } from './i18n-ka-names'

export type Lang = 'en' | 'ka'

let current: Lang = 'en'

/** Set by App on every render, before any child renders. */
export function setLang(lang: Lang) {
  current = lang
}

export function getLang() {
  return current
}

/**
 * Translates an English UI string. English text is the key, so a missing translation
 * falls back to English. `{name}` placeholders are filled from vars.
 */
export function t(text: string, vars?: Record<string, string | number>): string {
  let out = current === 'ka' ? (KA[text] ?? DESIGN_KA[text] ?? text) : text
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
  return out
}

/** Names of built-in foods, exercises and categories; anything else (user foods, AI names) is shown as is. */
export function tName(name: string): string {
  return current === 'ka' ? (KA_NAMES[name] ?? name) : name
}

/** Georgian name for search, whatever the current language. */
export function kaName(name: string): string | undefined {
  return KA_NAMES[name]
}

export function locale() {
  return current === 'ka' ? 'ka-GE' : undefined
}

/** Tells the AI which language to write names and advice in. */
export function aiLanguageNote() {
  return current === 'ka'
    ? '\nWrite every food name, meal name, description, tip and answer in Georgian (ქართული), using everyday Georgian food words.'
    : ''
}

// Words used in serving sizes ("1 slice", "2 eggs", "whole pack"), translated word by word.
const SERVING_WORDS: Record<string, string> = {
  piece: 'ცალი', pieces: 'ცალი', slice: 'ნაჭერი', slices: 'ნაჭერი', cup: 'ჭიქა', glass: 'ჭიქა', bowl: 'თასი', plate: 'თეფში',
  serving: 'პორცია', servings: 'პორცია', portion: 'პორცია', handful: 'მუჭა', tbsp: 'ს/კ', tsp: 'ჩ/კ', medium: 'საშუალო',
  small: 'პატარა', large: 'დიდი', whole: 'მთლიანი', can: 'ქილა', bottle: 'ბოთლი', fillet: 'ფილე', breast: 'მკერდი',
  egg: 'კვერცხი', eggs: 'კვერცხი', fruit: 'ხილი', skewer: 'შამფური', wrap: 'როლი', burger: 'ბურგერი', sandwich: 'სენდვიჩი',
  bar: 'ფილა', square: 'კუბიკი', cookie: 'ორცხობილა', biscuit: 'ბისკვიტი', scoop: 'ბურთულა', shot: 'სირჩა', container: 'პაკეტი',
  pack: 'შეფუთვა', loaf: 'პური', sheet: 'ფურცელი', ear: 'ტარო', clove: 'კბილი', stalk: 'ღერო', bunch: 'კონა', leaf: 'ფოთოლი',
  chop: 'კატლეტი', steak: 'სტეიკი', thigh: 'ბარძაყი', drumstick: 'ბარკალი', wing: 'ფრთა', sausage: 'სოსისი', roll: 'როლი',
  boat: 'ნავი', ball: 'ბურთულა', balls: 'ბურთულა', recipe: 'რეცეპტი', crepe: 'ბლინი', pancake: 'ბლინი',
  date: 'ფინიკი', fig: 'ლეღვი', berry: 'კენკრა', walnut: 'კაკალი', almond: 'ნუში', olives: 'ზეთისხილი', pickle: 'მწნილი',
  radish: 'ბოლოკი', beet: 'ჭარხალი', avocado: 'ავოკადო', pita: 'პიტა', tortilla: 'ტორტილია', bagel: 'ბეიგელი', croissant: 'კრუასანი',
  donut: 'დონატი', muffin: 'მაფინი', cake: 'ნამცხვარი', crackers: 'კრეკერი', white: 'ცილა',
  drained: 'გაწურული', raw: 'უმი', chopped: 'დაჭრილი', sliced: 'დაჭრილი', diced: 'კუბიკებად', shredded: 'დაჭრილი', grated: 'გახეხილი',
  cherry: 'ალუბლისებრი', tomato: 'პომიდორი', standard: 'სტანდარტული', pcs: 'ცალი', box: 'კოლოფი', wedge: 'ნაჭერი', half: 'ნახევარი',
  of: '', and: 'და',
}

export function tServing(label: string): string {
  if (current !== 'ka') return label
  return label
    .replace(/\b([A-Za-z]+)\b/g, (w) => SERVING_WORDS[w.toLowerCase()] ?? w)
    .replace(/\s{2,}/g, ' ')
    .trim()
}
