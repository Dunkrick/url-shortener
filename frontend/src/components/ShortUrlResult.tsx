import { useState } from 'react'

interface ShortUrlResultProps {
  shortUrl: string
  onReset: () => void
}

export function ShortUrlResult({
  shortUrl,
  onReset,
}: ShortUrlResultProps) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      setCopyError(null)

      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setCopyError('Copy failed. Select the link and copy it manually.')
    }
  }

  return (
    <section className="short-url-result" aria-labelledby="result-title">
      <p id="result-title" className="result-label">
        Your link is ready
      </p>

      <div className="result-row">
        <a href={shortUrl} target="_blank" rel="noreferrer">
          {shortUrl}
        </a>

        <button type="button" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {copied ? 'Link copied to clipboard.' : ''}
      </p>

      {copyError && <p className="result-error">{copyError}</p>}

      <button className="reset-button" type="button" onClick={onReset}>
        Shorten another URL
      </button>
    </section>
  )
}