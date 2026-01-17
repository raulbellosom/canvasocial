import { useEffect, useMemo, useState } from 'react'
import { account } from '../lib/appwrite'
import type { Models } from 'appwrite'

export function useAuth() {
  const [session, setSession] = useState<Models.Session | null>(null)
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function boot() {
      try {
        const u = await account.get()
        if (!mounted) return
        setUser(u)
        // Try to fetch a current session (Appwrite doesn't have a direct "current session" endpoint,
        // so we list sessions and pick the most recent as a best-effort.)
        const sessions = await account.listSessions()
        const current = sessions.sessions?.[0] ?? null
        setSession(current)
      } catch {
        setUser(null)
        setSession(null)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    boot()
    return () => { mounted = false }
  }, [])

  return useMemo(() => ({ session, user, isLoading, setSession, setUser }), [session, user, isLoading])
}
