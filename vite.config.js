import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// ver-tag：构建时间戳注入（vYYMMDD-HHMM）
const now = new Date()
const pad = n => String(n).padStart(2, '0')
const ver = 'v' + String(now.getFullYear()).slice(2) + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes())

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(ver),
  },
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
  },
})
