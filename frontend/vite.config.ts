import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Debug logging
console.log('🔍 Vite config loading...')
console.log('🔍 Current working directory:', process.cwd())
console.log('🔍 __dirname:', __dirname)
console.log('🔍 Files in current dir:', fs.readdirSync(process.cwd()))
console.log('🔍 Files in src dir:', fs.readdirSync(path.join(process.cwd(), 'src')))
console.log('🔍 index.html exists:', fs.existsSync(path.join(process.cwd(), 'index.html')))
console.log('🔍 main.tsx exists:', fs.existsSync(path.join(process.cwd(), 'src', 'main.tsx')))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
})
