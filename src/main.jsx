import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SimplifiedApp from './SimplifiedApp.jsx'
const ConsoleApp = lazy(() => import('./ConsoleApp.jsx'))
const isConsole = new URLSearchParams(window.location.search).get('view') === 'console'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<div style={{ padding: 32 }}>Loading CounterLens…</div>}>
      {isConsole ? <ConsoleApp /> : <SimplifiedApp />}
    </Suspense>
  </StrictMode>,
)
