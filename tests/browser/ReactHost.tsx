import { useSyncExternalStore } from 'react'
import { WispChat } from '@southneuhof/wisp-react-ui'
import '@southneuhof/wisp-react-ui/style.css'
import { createFixture } from './client'
const client = createFixture(
  new URLSearchParams(location.search).has('signedOut'),
)
export function ReactHost() {
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot)
  return <WispChat chat={{ client, state, url: 'http://os.example' }} />
}
