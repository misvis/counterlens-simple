import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SimplifiedApp from './SimplifiedApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SimplifiedApp />
  </StrictMode>,
)
