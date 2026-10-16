import { useState } from 'react'
import { shortenUrl } from './api'

export function useShortenUrl() {
  const [url, setUrl] = useState('')
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitUrl() {
    console.log('submitUrl called')
    setIsLoading(true)
    setError(null)
    setShortUrl(null)

    try {
      const result = await shortenUrl({ url })
      setShortUrl(result.short_url)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function reset() {
    setUrl('')
    setShortUrl(null)
    setError(null)
  }

  return {
    url,
    setUrl,
    shortUrl,
    isLoading,
    error,
    submitUrl,
    reset,
  }
}