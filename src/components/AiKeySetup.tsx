import { useState } from 'react'
import { t } from '../lib/i18n'
import { useStore } from '../lib/store'
import { checkKey } from '../lib/ai'
import { ErrorNote, Spinner } from './ui'

/** Explains how to get a free Gemini key and saves it after a quick test call. */
export default function AiKeySetup({ compact = false }: { compact?: boolean }) {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const [key, setKey] = useState(settings.geminiKey)
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'error'>(settings.geminiKey ? 'ok' : 'idle')
  const [error, setError] = useState('')

  async function save() {
    const trimmed = key.trim()
    setState('testing')
    setError('')
    try {
      // Also switches to a model this key can use if the current one isn't available to it.
      const model = await checkKey({ key: trimmed, model: settings.geminiModel })
      updateSettings({ geminiKey: trimmed, geminiModel: model })
      setState('ok')
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : t('The key could not be checked.'))
    }
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-muted">
          {t('AI features use Google Gemini’s free plan. You need your own free key, which takes about a minute:')}
        </p>
      )}
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>
          {t('Open')}{' '}
          <a className="font-medium text-accent underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>{' '}
          {t('and sign in with any Google account.')}
        </li>
        <li>{t('Tap “Create API key” and copy it.')}</li>
        <li>{t('Paste it here. It stays on this phone.')}</li>
      </ol>
      <div className="flex gap-2">
        <input
          className="field font-mono"
          placeholder={t('Paste your Gemini API key')}
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setState('idle')
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button className="btn btn-primary shrink-0" disabled={!key.trim() || state === 'testing'} onClick={save}>
          {t('Save')}
        </button>
      </div>
      {state === 'testing' && <Spinner label={t('Checking the key…')} />}
      {state === 'ok' && settings.geminiKey && <p className="text-sm font-medium text-accent">{t('AI is ready to use.')}</p>}
      {state === 'error' && <ErrorNote>{error}</ErrorNote>}
    </div>
  )
}
