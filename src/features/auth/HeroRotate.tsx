import { useEffect, useState } from 'react'
import { HAUL_SERVICES } from '../../shared/brand/services'

export default function HeroRotate({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const reduce = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: true }
    if (reduce.matches) return
    const id = window.setInterval(() => {
      setIndex(i => (i + 1) % HAUL_SERVICES.length)
    }, 6000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className={`absolute inset-0 ${className}`}>
      {HAUL_SERVICES.map((service, i) => (
        <img
          key={service.id}
          src={service.src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  )
}
