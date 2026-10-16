import { useEffect, useRef, useState } from 'react'
import { getStats } from './api'

export interface UseStatsResult {
  totalRedirects: number | null
  isRecentlyUpdated: boolean
}

export function useStats(pollIntervalMs = 5000): UseStatsResult {
  const [totalRedirects, setTotalRedirects] = useState<number | null>(null)
  const [isRecentlyUpdated, setIsRecentlyUpdated] = useState(false)
  const isInitialMount = useRef(true)
  const prevCountRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    let resetTimer: ReturnType<typeof setTimeout> | undefined

    const fetchStats = async () => {
      try {
        const stats = await getStats()
        if (!active) return

        const newCount = stats.total_redirects
        setTotalRedirects(newCount)

        if (isInitialMount.current) {
          isInitialMount.current = false
          prevCountRef.current = newCount
          return
        }

        if (prevCountRef.current !== null && newCount > prevCountRef.current) {
          setIsRecentlyUpdated(true)
          if (resetTimer) clearTimeout(resetTimer)
          resetTimer = setTimeout(() => {
            if (active) setIsRecentlyUpdated(false)
          }, 2200)
        }

        prevCountRef.current = newCount
      } catch {
        // Keep previous state on transient fetch failures
      }
    }

    fetchStats()

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStats()
      }
    }, pollIntervalMs)

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchStats()
      }
    }

    window.addEventListener('focus', handleFocusOrVisible)
    document.addEventListener('visibilitychange', handleFocusOrVisible)

    return () => {
      active = false
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocusOrVisible)
      document.removeEventListener('visibilitychange', handleFocusOrVisible)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [pollIntervalMs])

  return { totalRedirects, isRecentlyUpdated }
}