import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProvider } from '@/app/provider'
import { router } from '@/app/router'
import { moveLegacyStorage } from '@/lib/legacy-storage'

import '@/index.css'

moveLegacyStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  </StrictMode>,
)
