import type { FormEvent } from 'react'

interface UrlFormProps {
  url: string
  isLoading: boolean
  onUrlChange: (url: string) => void
  onSubmit: () => Promise<void>
}

export function UrlForm({
  url,
  isLoading,
  onUrlChange,
  onSubmit,
}: UrlFormProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSubmit()
  }

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="long-url">
        Long URL to shorten
      </label>

      <span className="input-icon" aria-hidden="true">
        ↗
      </span>

      <input
        id="long-url"
        type="url"
        placeholder="Paste your very long URL here..."
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        required
        disabled={isLoading}
      />

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Nipping…' : 'Nip it'}
        {!isLoading && <span aria-hidden="true"> →</span>}
      </button>
    </form>
  )
}