import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WispChat, useWispChat } from '@southneuhof/wisp-react-ui'
import '@southneuhof/wisp-react-ui/style.css'
function App() {
  const chat = useWispChat({
    url: import.meta.env.VITE_CLOUDFLARE_OS_URL || 'http://127.0.0.1:8787',
  })
  return <WispChat chat={chat} />
}
const root = document.getElementById('app')
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
