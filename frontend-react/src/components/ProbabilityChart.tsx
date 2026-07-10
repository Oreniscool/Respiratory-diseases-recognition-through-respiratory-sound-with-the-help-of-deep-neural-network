import { motion } from 'framer-motion'
import { CLASS_COLORS } from '../data/diseases'

interface Props {
  probabilities: Record<string, number>
  prediction: string
}

export default function ProbabilityChart({ probabilities, prediction }: Props) {
  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {entries.map(([cls, pct], i) => {
        const color = CLASS_COLORS[cls] ?? '#6366f1'
        const isTop = cls === prediction
        return (
          <motion.div
            key={cls}
            className={`probability-row ${isTop ? 'is-top' : ''}`}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ x: 4 }}
            transition={{ delay: i * 0.055, duration: 0.35 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <span style={{
              fontSize: '0.78rem', minWidth: '7rem',
              color: isTop ? color : 'var(--text-secondary)',
              fontWeight: isTop ? 700 : 500,
            }}>
              {cls}
            </span>
            <div className="mini-bar-track" style={{ flex: 1 }}>
              <motion.div
                className="mini-bar-fill"
                style={{ background: color, height: '100%', borderRadius: 3 }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.06, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </div>
            <span style={{
              fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace",
              color: isTop ? color : 'var(--text-secondary)',
              minWidth: '3.5rem', textAlign: 'right',
              fontWeight: isTop ? 700 : 400,
            }}>
              {pct.toFixed(1)}%
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
