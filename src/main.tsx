import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

document.documentElement.lang = 'tr'
document.documentElement.setAttribute('translate', 'no')
document.body.setAttribute('translate', 'no')
document.body.classList.add('notranslate')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
