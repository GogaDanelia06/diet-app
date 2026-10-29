import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Full colour PNGs so the dark gradient stays smooth.
    png: { compressionLevel: 9, quality: 100 },
    // The icon has its own dark background, so no extra padding anywhere.
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#05080a' } },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#05080a' } },
  },
  images: ['public/favicon.svg'],
})
