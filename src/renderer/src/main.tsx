import './lib/uint8array-polyfill'
import './app.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
