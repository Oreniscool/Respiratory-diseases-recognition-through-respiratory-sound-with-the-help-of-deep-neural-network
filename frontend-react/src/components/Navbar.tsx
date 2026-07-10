import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Activity } from 'lucide-react'

const NAV_LINKS = [
  { to: '/',            label: 'Home'        },
  { to: '/diagnose',    label: 'Analyze'      },
  { to: '/diseases',    label: 'Diseases'    },
  { to: '/how-it-works',label: 'How It Works'},
  { to: '/metrics',     label: 'Metrics'     },
  { to: '/chat',        label: '💬 Info Guide' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => setMobileOpen(false), [location.pathname])

  return (
    <motion.header
      className="site-header"
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transition: 'all 0.3s ease',
        background: scrolled
          ? 'rgba(8,19,33,0.96)'
          : 'rgba(8,19,33,0.84)',
        backdropFilter: 'blur(20px) saturate(135%)',
        borderBottom: scrolled ? '1px solid rgba(56,189,248,0.28)' : '1px solid rgba(148,163,184,0.16)',
        boxShadow: scrolled ? '0 14px 40px rgba(2,6,23,0.38)' : '0 8px 28px rgba(2,6,23,0.2)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          {/* Brand */}
          <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <motion.div
              whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
              transition={{ duration: 0.45 }}
              className="brand-mark"
              style={{
              width: 36, height: 36, borderRadius: '0.5rem',
              background: 'linear-gradient(135deg,#06b6d4,#6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={20} color="white" strokeWidth={2.5} />
            </motion.div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Respi<span className="gradient-text">Net</span>
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', gap: '0.25rem' }} className="hidden md:flex">
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                style={({ isActive }) => ({
                  padding: '0.4rem 0.9rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 650,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  color: isActive ? 'var(--cyan-400)' : 'var(--text-secondary)',
                  background: 'transparent',
                  position: 'relative',
                  overflow: 'hidden',
                })}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="desktop-nav-active"
                        className="nav-active-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="nav-link-label">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: '0.5rem',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            className="md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'rgba(5,13,26,0.97)',
              borderTop: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <nav style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {NAV_LINKS.map((link, index) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.045 }}
                >
                  <NavLink
                    to={link.to}
                    end={link.to === '/'}
                    style={({ isActive }) => ({
                      display: 'block',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      textDecoration: 'none',
                      color: isActive ? 'var(--cyan-400)' : 'var(--text-primary)',
                      background: isActive ? 'rgba(34,211,238,0.08)' : 'transparent',
                    })}
                  >
                    {link.label}
                  </NavLink>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
