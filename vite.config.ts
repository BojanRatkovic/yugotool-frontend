/// <reference types="vitest/config" />
import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: 'src/app/routes',
      generatedRouteTree: 'src/app/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 4800,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4810',
        changeOrigin: true,
        // zastava-api serves its routes at the root, so the `/api` marker the
        // browser uses to pick the proxy is stripped before forwarding.
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup-tests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json'],
      reportsDirectory: './coverage',
      // Registry-managed primitives are never hand-edited, so they are not ours to cover.
      exclude: ['src/components/ui/**', 'src/hooks/use-mobile.ts', 'src/app/routeTree.gen.ts'],
    },
  },
})
