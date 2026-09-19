import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), ''), ...loadEnv(mode, '..', '') }
  const hmrClientPort = env.VITE_HMR_CLIENT_PORT || env.HMR_CLIENT_PORT

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      watch: {
        usePolling: true,
      },
      ...(hmrClientPort ? { hmr: { clientPort: parseInt(hmrClientPort, 10) } } : {}),
    },
  }
})

