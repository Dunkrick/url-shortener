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
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Nip home">
          nip<span>.</span>
        </a>

        <nav className="header-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a
            href="https://github.com/Dunkrick/url-shortener"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      </header>

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
          <div className="section-heading">
            <p className="section-kicker">THE SMALL THINGS MATTER</p>
            <h2 id="features-title">Simple on the surface.</h2>
            <p>Thoughtfully built underneath.</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-wordmark" href="/" aria-label="Nip home">
          nip.
        </a>

        <p>Made with intention by Rithwick.</p>

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