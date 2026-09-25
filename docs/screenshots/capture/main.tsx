/**
 * README screenshot harness: mounts the real ui/src/App.tsx with the host's real
 * `@kirocrew/app-sdk/ui` components and theme, and a FAKE `@kirocrew/app-sdk`
 * (fake-sdk.tsx) that answers every fetch with demo data. See shoot.mjs.
 */
import { createRoot } from 'react-dom/client'
// Resolved by shoot.mjs to the host checkout's i18n bootstrap (the host components
// render catalog strings, which are empty until i18n is initialised).
import { initI18n } from '@host/i18n/all'
import SlackRadar from '../../../ui/src/App'
import './harness.css'

initI18n('en')
document.documentElement.setAttribute('data-theme', 'dark')
createRoot(document.getElementById('root')!).render(
  <div className="flex flex-col h-screen bg-bg text-text">
    <SlackRadar />
  </div>,
)
