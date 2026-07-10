import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Volume2, AlertTriangle, CheckCircle } from 'lucide-react'
import { DISEASES, type DiseaseInfo } from '../data/diseases'

const SEVERITY_LABEL: Record<string, string> = { mild: 'Mild', moderate: 'Moderate', severe: 'Severe' }
const SEVERITY_COLOR: Record<string, string> = { mild: '#10b981', moderate: '#f59e0b', severe: '#ef4444' }

function DiseaseCard({ disease }: { disease: DiseaseInfo }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4, scale: 1.006 }}
      animate={{
        boxShadow: expanded
          ? `0 24px 68px rgba(2,6,23,0.55), 0 0 30px ${disease.color}16`
          : '0 0 0 rgba(2,6,23,0)',
      }}
      className={`glass-card disease-card ${expanded ? 'is-expanded' : ''}`}
      style={{ overflow: 'hidden', borderColor: `${disease.color}30` }}
    >
      {/* Header */}
      <button
        className="disease-card-trigger"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls={`disease-${disease.id}-details`}
        style={{
          width: '100%', padding: '1.25rem 1.5rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Icon */}
        <motion.div
          className="disease-icon"
          animate={{ rotate: expanded ? -4 : 0, scale: expanded ? 1.08 : 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          style={{
          width: 48, height: 48, borderRadius: '0.75rem', flexShrink: 0,
          background: `${disease.color}20`, fontSize: '1.4rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {disease.icon}
        </motion.div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: disease.color }}>{disease.name}</span>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 999,
              background: `${SEVERITY_COLOR[disease.severity]}15`, color: SEVERITY_COLOR[disease.severity],
              border: `1px solid ${SEVERITY_COLOR[disease.severity]}40`,
            }}>
              {SEVERITY_LABEL[disease.severity]}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{disease.tagline}</p>
        </div>

        {/* Acoustic badges */}
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          {disease.acousticProfile.crackles && (
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>Crackles</span>
          )}
          {disease.acousticProfile.wheezes && (
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>Wheezes</span>
          )}
          {!disease.acousticProfile.crackles && !disease.acousticProfile.wheezes && (
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>Clear</span>
          )}
        </div>

        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          style={{ display: 'grid', placeItems: 'center' }}
        >
          <ChevronDown size={18} color="var(--text-muted)" />
        </motion.span>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            id={`disease-${disease.id}-details`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.87rem', color: 'var(--text-secondary)', lineHeight: 1.75, marginTop: '1.25rem', marginBottom: '1.5rem' }}>
                {disease.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.25rem' }}>
                {/* Symptoms */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <AlertTriangle size={14} color={disease.color} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: disease.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Symptoms</span>
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {disease.symptoms.map(s => (
                      <li key={s} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ color: disease.color, marginTop: 2, flexShrink: 0 }}>›</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Acoustic Profile */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <Volume2 size={14} color={disease.color} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: disease.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acoustic Profile</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: 999,
                      background: disease.acousticProfile.crackles ? 'rgba(239,68,68,0.1)' : 'rgba(30,30,50,0.4)',
                      color: disease.acousticProfile.crackles ? '#f87171' : 'var(--text-muted)',
                      border: `1px solid ${disease.acousticProfile.crackles ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                    }}>
                      Crackles: {disease.acousticProfile.crackles ? 'Yes' : 'No'}
                    </span>
                    <span style={{
                      fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: 999,
                      background: disease.acousticProfile.wheezes ? 'rgba(245,158,11,0.1)' : 'rgba(30,30,50,0.4)',
                      color: disease.acousticProfile.wheezes ? '#fbbf24' : 'var(--text-muted)',
                      border: `1px solid ${disease.acousticProfile.wheezes ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                    }}>
                      Wheezes: {disease.acousticProfile.wheezes ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    {disease.acousticProfile.notes}
                  </p>
                </div>

                {/* Treatment */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <CheckCircle size={14} color={disease.color} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: disease.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Treatment</span>
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {disease.treatment.map(t => (
                      <li key={t} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ color: disease.color, marginTop: 2, flexShrink: 0 }}>›</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risk Factors */}
                <div>
                  <div style={{ marginBottom: '0.6rem', fontSize: '0.75rem', fontWeight: 700, color: disease.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Risk Factors
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {disease.riskFactors.map(r => (
                      <span key={r} style={{
                        fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: 999,
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                      }}>
                        {r}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'var(--bg-tertiary)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    📊 {disease.prevalence}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function DiseasesPage() {
  const [filter, setFilter] = useState<'all' | 'mild' | 'moderate' | 'severe'>('all')
  const filtered = filter === 'all' ? DISEASES : DISEASES.filter(d => d.severity === filter)

  return (
    <div style={{ paddingTop: 64, minHeight: '100vh' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '3rem 1.5rem' }}>
        {/* Header */}
        <motion.div
          className="page-intro"
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: 'center', marginBottom: '2.5rem' }}
        >
          <div className="section-tag">Library</div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.03em', marginTop: '0.5rem' }}>
            Disease <span className="gradient-text">Encyclopedia</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', maxWidth: 500, margin: '0.75rem auto 0' }}>
            Detailed profiles of all 8 respiratory conditions detected by RespiNet — symptoms, acoustic signatures, and treatment options.
          </p>
        </motion.div>

        {/* Filter tabs */}
        <div className="filter-dock" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {(['all','mild','moderate','severe'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="filter-pill"
              style={{
                padding: '0.4rem 1rem', borderRadius: 999, cursor: 'pointer',
                border: '1px solid', fontSize: '0.8rem', fontWeight: 600,
                borderColor: filter === f ? 'var(--cyan-400)' : 'var(--border)',
                background: filter === f ? 'rgba(34,211,238,0.08)' : 'transparent',
                color: filter === f ? 'var(--cyan-400)' : 'var(--text-secondary)',
                transition: 'all 0.2s', textTransform: 'capitalize',
              }}
            >
              {filter === f && (
                <motion.span
                  layoutId="disease-filter-active"
                  className="filter-pill-active"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>
                {f === 'all' ? 'All Conditions' : f}
              </span>
            </button>
          ))}
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <AnimatePresence mode="popLayout">
            {filtered.map(d => (
              <DiseaseCard key={d.id} disease={d} />
            ))}
          </AnimatePresence>
        </div>

        {/* Disclaimer */}
        <div style={{
          marginTop: '3rem', padding: '1rem 1.25rem', borderRadius: '0.75rem',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          ⚕️ <strong style={{ color: 'var(--text-secondary)' }}>Medical Disclaimer:</strong> The information provided here is for educational and research purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional for medical concerns.
        </div>
      </div>
    </div>
  )
}
