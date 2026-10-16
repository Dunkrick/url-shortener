import { UrlForm } from './components/UrlForm'
import { ShortUrlResult } from './components/ShortUrlResult'
import { useShortenUrl } from './features/shorten/useShortenUrl'
import { useStats } from './features/stats/useStats'
import './App.css'

function App() {
  const {
    url,
    setUrl,
    shortUrl,
    isLoading,
    error,
    submitUrl,
    reset,
  } = useShortenUrl()
  const { totalRedirects, isRecentlyUpdated } = useStats()

  return (
    <div className="page">
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">
            Long links.
            <br />
            Nip them <span className="accent-text">short.</span>
          </h1>

          <p className="hero-description">
            Drop a long URL below and make it wonderfully short.
          </p>

          <UrlForm
            url={url}
            isLoading={isLoading}
            onUrlChange={setUrl}
            onSubmit={submitUrl}
          />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {shortUrl && (
            <ShortUrlResult shortUrl={shortUrl} onReset={reset} />
          )}
        </section>

        <p className="tech-stack">Go · PostgreSQL · Redis</p>
      </main>

      <footer className="site-footer">
        <a className="footer-wordmark" href="/" aria-label="Nip home">
          nip.
        </a>

        {totalRedirects !== null && (
          <p
            className={`redirect-count ${isRecentlyUpdated ? 'is-active' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span className="redirect-dot" aria-hidden="true" />
            <span className="redirect-text">
              Total redirects:{' '}
              <strong className="redirect-number">
                {totalRedirects.toLocaleString()}
              </strong>{' '}
              nips so far
            </span>
          </p>
        )}

        <p className="footer-author">Built by Rithwick</p>

        <nav className="footer-socials" aria-label="Social links">
          <a
            href="https://www.linkedin.com/in/rithwick-gurram/"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn profile"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2ZM8.34 18H5.67V9.4h2.67ZM7 8.22a1.55 1.55 0 1 1 .02-3.1A1.55 1.55 0 0 1 7 8.22ZM18.34 18h-2.67v-4.19c0-1-.02-2.28-1.39-2.28-1.39 0-1.6 1.08-1.6 2.2V18h-2.67V9.4h2.56v1.17h.04a2.8 2.8 0 0 1 2.52-1.39c2.7 0 3.21 1.78 3.21 4.1Z" />
            </svg>
          </a>

          <a
            href="https://github.com/Dunkrick"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub profile"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.7 2.62 1.21 3.26.92.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.06 1.15a10.65 10.65 0 0 1 5.57 0c2.12-1.44 3.05-1.15 3.05-1.15.61 1.54.23 2.68.12 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.61 5.23-5.1 5.51.4.35.76 1.03.76 2.08V22c0 .29.2.63.76.52A11.1 11.1 0 0 0 12 .9Z" />
            </svg>
          </a>
        </nav>
      </footer>
    </div>
  )
}

export default App