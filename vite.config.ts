import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE=/mentor-ai/ when building for GitHub Pages (project site).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { host: true },
  build: { target: 'es2022', sourcemap: false },
})
