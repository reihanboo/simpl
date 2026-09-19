import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), ''), ...loadEnv(mode, '..', '') }
  const rawHmrPort = env.VITE_HMR_CLIENT_PORT || env.HMR_CLIENT_PORT
  const parsedHmrPort = rawHmrPort ? Number.parseInt(rawHmrPort, 10) : NaN
  const isValidHmrPort = !Number.isNaN(parsedHmrPort) && parsedHmrPort > 0

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      watch: {
        usePolling: true,
      },
      ...(isValidHmrPort ? { hmr: { clientPort: parsedHmrPort } } : {}),
    },
  }
})


