import { useState } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // We'll connect this form to the Go API next.
  }

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
              onChange={(event) => setUrl(event.target.value)}
              required
            />

            <button type="submit">
              Nip it <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>

        <section
          className="features-section"
          id="features"
          aria-labelledby="features-title"
        >
          <p className="tech-stack">Go · PostgreSQL · Redis</p>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-wordmark" href="/" aria-label="Nip home">
          nip.
        </a>

        <p>Built by Rithwick</p>

        <a
          href="https://github.com/Dunkrick/url-shortener"
          target="_blank"
          rel="noreferrer"
        >
          Open source ↗
        </a>
      </footer>
    </div>
  )
}

export default App