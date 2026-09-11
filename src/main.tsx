import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

/*
 * Fonts, by voice: Outfit for Latin display and body, Blinker for labels and counters,
 * JetBrains Mono for code, and Noto Sans SC for Chinese in every voice. Chinese is one face
 * on purpose - a kai/hei split changes drawing system whenever a sentence mixes `C++` into
 * Chinese. Only two weights of it: 400 for body and 700 for the crash heading, since the
 * package is sliced by `unicode-range` and an unused weight is a stylesheet entry nothing
 * matches. See `src/styles/tokens.css`.
 */
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/blinker/400.css'
import '@fontsource/blinker/600.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/700.css'

import App from './App'
import ErrorBoundary, { CrashFallback } from './components/ErrorBoundary'
import './styles/tokens.css'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Mount point #root not found')

createRoot(container).render(
  <StrictMode>
    {/* Top-level boundary: a blank page is the worst failure mode, so anything that
        throws below this still leaves a usable page with a way out. */}
    <ErrorBoundary label="app" fallback={<CrashFallback />}>
      {/* `basename` from Vite's BASE_URL, so a move to a project repo works with no route
          edited. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
