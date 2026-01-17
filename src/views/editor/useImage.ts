import { useEffect, useState } from 'react'

export default function useImage(url?: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!url) {
      setImage(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    const onload = () => setImage(img)
    const onerror = () => setImage(null)
    img.addEventListener('load', onload)
    img.addEventListener('error', onerror)
    return () => {
      img.removeEventListener('load', onload)
      img.removeEventListener('error', onerror)
    }
  }, [url])

  return [image] as const
}
