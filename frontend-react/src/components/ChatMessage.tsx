import { motion } from 'framer-motion'
import type { ChatMessage as ChatMessageType } from '../store/chatStore'
import { Activity } from 'lucide-react'

interface Props {
  message: ChatMessageType
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        gap: '0.6rem',
        marginBottom: '1rem',
      }}
    >
      {/* Bot avatar */}
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg,#06b6d4,#6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Activity size={16} color="white" />
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: '78%',
        padding: '0.75rem 1rem',
        borderRadius: isUser ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
        fontSize: '0.875rem',
        lineHeight: 1.65,
        background: isUser
          ? 'linear-gradient(135deg,rgba(6,182,212,0.2),rgba(99,102,241,0.2))'
          : 'var(--bg-card)',
        border: isUser
          ? '1px solid rgba(34,211,238,0.25)'
          : '1px solid var(--border)',
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
      }}>
        {message.typing ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        ) : (
          message.content
        )}
      </div>

      {/* Timestamp */}
      {!message.typing && (
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: 2 }}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </motion.div>
  )
}
