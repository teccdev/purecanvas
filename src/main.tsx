import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PrivacyPolicy } from './components/PrivacyPolicy.tsx'
import { initAnalytics } from './lib/analytics.ts'

const isPrivacyPage = window.location.pathname.replace(/\/+$/, '') === '/privacy'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPrivacyPage ? <PrivacyPolicy /> : <App />}
  </StrictMode>,
)
