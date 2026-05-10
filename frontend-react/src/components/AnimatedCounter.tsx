import { useRef, useEffect, useState } from 'react'
import { useInView } from 'framer-motion'

interface Props {
  target: number
  decimals?: number
  suffix?: string
  duration?: number
}

export default function AnimatedCounter({ target, decimals = 2, suffix = '', duration = 1800 }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setValue(ease * target)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [inView, target, duration])

  return (
    <span ref={ref}>
      {value.toFixed(decimals)}{suffix}
    </span>
  )
}
