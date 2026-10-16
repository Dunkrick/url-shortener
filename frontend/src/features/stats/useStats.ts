import { useEffect, useState } from 'react'
import { getStats } from './api'

export function useStats() {
  const [totalRedirects, setTotalRedirects] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    getStats()
      .then((stats) => {
        if (active) setTotalRedirects(stats.total_redirects)
      })
      .catch(() => {
        if (active) setTotalRedirects(null)
      })

    return () => {
      active = false
    }
  }, [])

  return totalRedirects
}