import { useEffect, useMemo, useState } from 'react'

type Theme = 'dark' | 'light'

const KEY = 'canvas_social_theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? null
    const initial = saved ?? 'dark'
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem(KEY, next)
  }

  return useMemo(() => ({ theme, toggle }), [theme])
}
