import { useState } from 'react'
import { t } from '../lib/i18n'
import { useStore } from '../lib/store'
import { checkKey } from '../lib/ai'
import { KeyAction, KeyStatus, maskKey } from './KeyStatus'
import { ErrorNote, Spinner } from './ui'

/** Explains how to get a free Gemini key and saves it after a quick check; once saved it shows as added, with Edit. */
export default function AiKeySetup({ compact = false }: { compact?: boolean }) {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const [editing, setEditing] = useState(!settings.geminiKey)
  const [key, setKey] = useState('')
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
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
      setEditing(false)
      setKey('')
    } catch (e) {
      setState('error')
      setError(e instanceof Error ? e.message : t('The key could not be checked.'))
    }
  }

  function stopEditing() {
    setEditing(false)
    setKey('')
    setState('idle')
    setError('')
  }

  if (settings.geminiKey && !editing) {
    return (
      <div className="space-y-3">
        <KeyStatus title={t('Gemini key added')} detail={`${maskKey(settings.geminiKey)} · ${settings.geminiModel}`}>
          <KeyAction onClick={() => { setEditing(true); setState('idle') }}>{t('Edit')}</KeyAction>
        </KeyStatus>
        {state === 'ok' && <p className="text-sm font-medium text-accent" role="status">{t('AI is ready to use.')}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!compact && !settings.geminiKey && (
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
          placeholder={t(settings.geminiKey ? 'Paste the new key' : 'Paste your Gemini API key')}
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
      {settings.geminiKey && (
        <div className="flex gap-2">
          <button type="button" className="btn btn-quiet flex-1" onClick={stopEditing}>{t('Cancel')}</button>
          <button
            type="button"
            className="btn btn-quiet flex-1 text-over"
            onClick={() => {
              updateSettings({ geminiKey: '' })
              setKey('')
              setState('idle')
            }}
          >
            {t('Remove key')}
          </button>
        </div>
      )}
      {state === 'testing' && <Spinner label={t('Checking the key…')} />}
      {state === 'error' && <ErrorNote>{error}</ErrorNote>}
    </div>
  )
}
