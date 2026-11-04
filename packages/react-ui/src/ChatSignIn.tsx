import { useState } from 'react'
import type { FormEvent } from 'react'
import { useChatMessages } from './primitives.js'
export function ChatSignIn({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean
  error: string
  onSubmit: (input: { username: string; password: string }) => void
}) {
  const t = useChatMessages()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const secret = password
    setPassword('')
    onSubmit({ username: username.trim(), password: secret })
  }
  return (
    <form
      className="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-mx-auto wisp-flex wisp-min-h-[320px] wisp-w-full wisp-max-w-[680px] wisp-items-center wisp-justify-center wisp-px-4 wisp-py-6"
      onSubmit={submit}
    >
      <div className="wisp-grid wisp-w-full wisp-max-w-sm wisp-gap-4 wisp-p-6">
        <div className="wisp-grid wisp-gap-1">
          <h2 className="wisp-text-lg wisp-font-semibold wisp-text-on-surface">
            {t.signIn}
          </h2>
          <p className="wisp-text-sm wisp-text-on-surface-variant">
            {t.signInDescription}
          </p>
        </div>
        <label className="wisp-grid wisp-gap-1.5 wisp-text-sm wisp-text-on-surface-variant">
          {t.username}
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="wisp-min-h-11 wisp-rounded-xl wisp-border wisp-border-outline-variant wisp-bg-transparent wisp-px-3 wisp-text-sm wisp-text-on-surface"
            disabled={busy}
          />
        </label>
        <label className="wisp-grid wisp-gap-1.5 wisp-text-sm wisp-text-on-surface-variant">
          {t.password}
          <input
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            className="wisp-min-h-11 wisp-rounded-xl wisp-border wisp-border-outline-variant wisp-bg-transparent wisp-px-3 wisp-text-sm wisp-text-on-surface"
            disabled={busy}
          />
        </label>
        {error && (
          <p className="wisp-text-sm wisp-text-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="wisp-min-h-11 wisp-rounded-xl wisp-bg-primary wisp-px-4 wisp-text-sm wisp-font-semibold wisp-text-on-primary wisp-transition hover:wisp-brightness-110 disabled:wisp-opacity-50"
          disabled={busy}
        >
          {busy ? t.signingIn : t.signIn}
        </button>
      </div>
    </form>
  )
}
