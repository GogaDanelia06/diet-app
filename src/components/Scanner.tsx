import { useEffect, useRef, useState } from 'react'
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { lookupBarcode } from '../lib/online'
import { useStore } from '../lib/store'
import type { Food } from '../lib/types'
import { ErrorNote, Icon, Spinner } from './ui'
import FoodEditor from './FoodEditor'

// Serve the barcode reader from this app instead of a CDN so it also works offline.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? new URL(wasmUrl, location.href).href : prefix + path),
  },
})

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const

type Status =
  | { kind: 'idle' }
  | { kind: 'looking'; code: string }
  | { kind: 'missing'; code: string }
  | { kind: 'error'; message: string }

export default function Scanner({ onFound }: { onFound: (f: Food) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<'starting' | 'on' | 'denied' | 'off'>('starting')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [manual, setManual] = useState('')
  const [editor, setEditor] = useState<{ code: string; useAi: boolean } | null>(null)
  const busy = useRef(false)
  const customFoods = useStore((s) => s.customFoods)
  const entries = useStore((s) => s.entries)

  async function handleCode(code: string) {
    if (busy.current) return
    busy.current = true
    navigator.vibrate?.(40)
    try {
      const local = customFoods.find((f) => f.barcode === code) ?? entries.findLast((e) => e.food?.barcode === code)?.food
      if (local) {
        onFound(local)
        return
      }
      setStatus({ kind: 'looking', code })
      const food = await lookupBarcode(code)
      if (food) {
        setStatus({ kind: 'idle' })
        onFound(food)
      } else {
        setStatus({ kind: 'missing', code })
      }
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Lookup failed. Check your internet connection.' })
    } finally {
      // Give the user a moment before the same barcode can trigger again.
      setTimeout(() => (busy.current = false), 1500)
    }
  }

  const handleRef = useRef(handleCode)
  handleRef.current = handleCode

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false
    const detector = new BarcodeDetector({ formats: [...FORMATS] })

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('off')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setCamera('on')
        const tick = async () => {
          if (stopped) return
          if (!busy.current && video.readyState >= 2) {
            try {
              const codes = await detector.detect(video)
              if (codes[0]?.rawValue) handleRef.current(codes[0].rawValue)
            } catch {
              // A single bad frame is fine; keep scanning.
            }
          }
          timer = window.setTimeout(tick, 250)
        }
        tick()
      } catch {
        setCamera('denied')
      }
    }
    start()
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function fromPhoto(file: File) {
    try {
      const bitmap = await createImageBitmap(file)
      const codes = await new BarcodeDetector({ formats: [...FORMATS] }).detect(bitmap)
      if (codes[0]?.rawValue) handleCode(codes[0].rawValue)
      else setStatus({ kind: 'error', message: 'No barcode found in that photo. Try a closer, sharper shot or type the number.' })
    } catch {
      setStatus({ kind: 'error', message: 'Could not read that photo.' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {camera === 'on' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1/3 w-3/4 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {camera !== 'on' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-sm text-white/85">
            {camera === 'starting' && 'Starting camera…'}
            {camera === 'denied' && 'Camera access is off. Allow it in Settings → Safari → Camera, or use a photo or the number below.'}
            {camera === 'off' && 'Live camera isn’t available here. Use a photo or type the number below.'}
          </div>
        )}
      </div>
      {camera === 'on' && <p className="text-center text-sm text-muted">Point at the barcode on the package</p>}

      {status.kind === 'looking' && <Spinner label={`Looking up ${status.code}…`} />}
      {status.kind === 'error' && <ErrorNote>{status.message}</ErrorNote>}
      {status.kind === 'missing' && (
        <div className="space-y-3 rounded-[20px] bg-surface p-4">
          <p>
            <strong>{status.code}</strong> isn’t in the online database yet. Add it once and Plate will remember it next time.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-primary" onClick={() => setEditor({ code: status.code, useAi: true })}>
              <Icon name="camera" className="h-4 w-4" /> Read label
            </button>
            <button className="btn btn-quiet" onClick={() => setEditor({ code: status.code, useAi: false })}>
              Type it in
            </button>
          </div>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const code = manual.replace(/\D/g, '')
          if (code.length >= 6) handleCode(code)
        }}
      >
        <input className="field num" inputMode="numeric" placeholder="Or type the barcode number" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn btn-quiet shrink-0" type="submit">
          Look up
        </button>
      </form>
      <label className="btn btn-quiet w-full cursor-pointer">
        <Icon name="camera" className="h-5 w-5" /> Scan from a photo
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && fromPhoto(e.target.files[0])} />
      </label>

      {editor && (
        <FoodEditor
          barcode={editor.code}
          startWithLabelScan={editor.useAi}
          onClose={() => setEditor(null)}
          onSaved={(f) => {
            setEditor(null)
            setStatus({ kind: 'idle' })
            onFound(f)
          }}
        />
      )}
    </div>
  )
}
