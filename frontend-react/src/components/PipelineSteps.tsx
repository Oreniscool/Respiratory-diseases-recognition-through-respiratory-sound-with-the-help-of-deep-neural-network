import { motion } from 'framer-motion'
import { CheckCircle, Loader2 } from 'lucide-react'

export interface Step {
  id: number
  icon: string
  label: string
  detail: string
  status: 'idle' | 'active' | 'done'
}

interface Props {
  steps: Step[]
}

export default function PipelineSteps({ steps }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {steps.map((step, i) => (
        <div key={step.id}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              border: `1px solid ${
                step.status === 'done'   ? 'rgba(16,185,129,0.3)'  :
                step.status === 'active' ? 'rgba(34,211,238,0.3)'  :
                'var(--border)'
              }`,
              background: step.status === 'done'
                ? 'rgba(16,185,129,0.05)'
                : step.status === 'active'
                ? 'rgba(34,211,238,0.05)'
                : 'var(--bg-card)',
              transition: 'all 0.4s ease',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 40, height: 40, borderRadius: '0.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem',
              background: step.status === 'done'   ? 'rgba(16,185,129,0.15)'  :
                          step.status === 'active' ? 'rgba(34,211,238,0.15)'  :
                          'var(--bg-tertiary)',
              flexShrink: 0,
            }}>
              {step.status === 'active'
                ? <Loader2 size={20} color="var(--cyan-400)" style={{ animation: 'spin 1s linear infinite' }} />
                : step.icon}
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {step.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                {step.detail}
              </div>
            </div>

            {/* Check */}
            {step.status === 'done' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                <CheckCircle size={20} color="#10b981" />
              </motion.div>
            )}
          </motion.div>

          {/* Connector */}
          {i < steps.length - 1 && (
            <div style={{
              width: 2, height: 10, marginLeft: '1.5rem',
              background: step.status === 'done' ? 'rgba(16,185,129,0.4)' : 'var(--border)',
              transition: 'background 0.4s ease',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}
