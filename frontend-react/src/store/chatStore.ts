import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  typing?: boolean
}

interface ChatStore {
  messages: ChatMessage[]
  isTyping: boolean
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  setTyping: (v: boolean) => void
  updateMessage: (id: string, content: string, typing?: boolean) => void
  clearChat: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isTyping: false,

  addMessage: (msg) => {
    const id = crypto.randomUUID()
    set(state => ({
      messages: [...state.messages, { ...msg, id, timestamp: new Date() }],
    }))
    return id
  },

  setTyping: (v) => set({ isTyping: v }),

  updateMessage: (id, content, typing = false) =>
    set(state => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, content, typing } : m
      ),
    })),

  clearChat: () => set({ messages: [], isTyping: false }),
}))
