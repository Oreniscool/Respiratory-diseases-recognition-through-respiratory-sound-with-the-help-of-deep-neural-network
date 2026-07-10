import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Trash2, MessageCircle } from "lucide-react";
import { useChatStore } from "../store/chatStore";
import ChatMessageBubble from "../components/ChatMessage";
import { DISEASES } from "../data/diseases";

// ─── Rule-based health advisor ─────────────────────────────────────
const SUGGESTIONS = [
  "What is COPD?",
  "What causes pneumonia?",
  "How does the model work?",
  "What are wheezes?",
  "Symptoms of bronchiectasis",
  "How accurate is RespiNet?",
  "What is MFCC?",
  "Is this a real diagnosis?",
];

function buildResponse(input: string): string {
  const q = input.toLowerCase().trim();

  // Disclaimer / medical advice
  if (
    /diagnos|real doctor|see a|consult|professional|advice|treatment plan/.test(
      q,
    )
  ) {
    return "⚕️ **Important:** RespiNet is a research and educational tool — it does **not** provide medical diagnoses or replace professional healthcare advice.\n\nIf you have respiratory symptoms, please consult a licensed physician or pulmonologist. Early professional evaluation is key for conditions like COPD and pneumonia.";
  }

  // Accuracy / model performance
  if (/accurac|how good|performance|f1|precision|recall|reliable/.test(q)) {
    return "🎯 **Historical RespiNet Run (Epoch 50/50)**\n\n• **Final train accuracy:** 82.12%\n• **Final validation accuracy:** 73.44%\n• **Best validation accuracy:** 75.36% at epoch 48\n• **Final train loss:** 0.4229\n• **Final validation loss:** 0.8203\n\n⚠️ These are archived development metrics from the previous leakage-prone sample split. They must be replaced after patient-level evaluation and are not evidence of clinical performance.";
  }

  // MFCC explanation
  if (/mfcc|mel.freq|cepstral|feature extract/.test(q)) {
    return "📊 **MFCC — Mel-Frequency Cepstral Coefficients**\n\nMFCCs are the most widely used feature in speech and respiratory sound analysis. They capture the shape of the vocal/bronchial tract.\n\n**How it works:**\n1. Divide the audio into short overlapping frames (~25 ms)\n2. Apply FFT to get the frequency spectrum\n3. Map onto the Mel scale (mimics human hearing)\n4. Take the log of the Mel spectrum\n5. Apply DCT to get cepstral coefficients\n\nRespiNet extracts **40 MFCCs** per frame, plus their **delta** (1st derivative) and **delta-delta** (2nd derivative), giving **120 features** per time step. The final feature matrix is (200 × 120).";
  }

  // GRU / architecture
  if (
    /gru|bidirectional|neural network|architecture|model|lstm|deep learn/.test(
      q,
    )
  ) {
    return "🧠 **RespiNet Architecture — Conv1D + Bidirectional GRU**\n\n**Input:** 200 frames × 120 MFCC/delta features\n**Temporal layers:** Conv1D(64, kernel 5) → Conv1D(64, kernel 3)\n**Recurrent layers:** Bidirectional GRU(64) → Bidirectional GRU(32)\n**Head:** Global average pooling → Dense(64) → Dropout → Softmax\n\n**Optimizer:** Adamax | **Loss:** Categorical cross-entropy\n**Parameters:** approximately 137k from the current source; verify from the next trained artifact.";
  }

  // Crackles
  if (/crackle/.test(q)) {
    return "🔊 **Crackles (Adventitious Lung Sounds)**\n\nCrackles are discontinuous, explosive sounds heard during auscultation. They occur when collapsed or fluid-filled airways suddenly pop open during breathing.\n\n**Types:**\n• **Fine crackles** — high-pitched, short duration; heard in pneumonia, pulmonary fibrosis\n• **Coarse crackles** — low-pitched, longer; heard in bronchiectasis, COPD, bronchitis\n\n**Conditions with crackles:** COPD, Pneumonia, Bronchiectasis, LRTI, Bronchiolitis";
  }

  // Wheezes
  if (/wheez/.test(q)) {
    return "🎵 **Wheezes (Adventitious Lung Sounds)**\n\nWheezes are continuous, musical sounds caused by air passing through narrowed airways. They are usually heard on expiration.\n\n**Types:**\n• **Polyphonic wheezes** — multiple pitches; classic in asthma\n• **Monophonic wheeze** — single pitch; suggests localized obstruction\n• **Stridor** — inspiratory wheeze from upper airway obstruction\n\n**Conditions with wheezes:** Asthma, URTI, Bronchiolitis, severe COPD";
  }

  // ICBHI dataset
  if (/icbhi|dataset|data|recording/.test(q)) {
    return "📦 **ICBHI 2017 Respiratory Sound Dataset**\n\nThe International Conference on Biomedical and Health Informatics 2017 benchmark dataset:\n\n• **920** annotated audio recordings\n• **6,898** respiratory cycles\n• **126** unique patients\n• **8** disease classes\n• Devices: Meditron, AKGC417L, Littmann Classic II SE, Welch Allyn Meditron\n• Recording locations: anterior, posterior, and lateral chest positions\n• Sample rates: 4 kHz to 44.1 kHz\n\nThe dataset is the gold standard for respiratory sound classification research.";
  }

  // Is this real / disclaimer
  if (/real|legit|trust|accurate enough|safe/.test(q)) {
    return '⚠️ **About RespiNet\'s Reliability**\n\nRespiNet does not currently have a trustworthy clinical-performance estimate. The archived run used a leakage-prone sample split and must be repeated with patient-level train/validation/test partitions.\n\n• The dataset is limited\n• Device and recording-environment changes may reduce performance\n• Background noise and unsupported audio can produce unreliable outputs\n• The model always selects a class unless an abstention layer is added\n\n**Bottom line:** Treat it as a research and learning tool, not a screening or diagnostic system.';
  }

  // Disease-specific queries
  for (const disease of DISEASES) {
    if (disease.keywords.some((kw) => q.includes(kw))) {
      return `🩺 **${disease.name} — ${disease.tagline}**\n\n${disease.description}\n\n**Common symptoms:**\n${disease.symptoms.map((s) => `• ${s}`).join("\n")}\n\n**Acoustic profile:**\n${disease.acousticProfile.notes}\n\n**Treatment options:**\n${disease.treatment.map((t) => `• ${t}`).join("\n")}\n\n---\n_For a definitive diagnosis, consult a healthcare professional._`;
    }
  }

  // Prevention / general health
  if (/prevent|protect|healthy lung|improve breathing|exercise/.test(q)) {
    return "💚 **Maintaining Healthy Lungs**\n\n**Do:**\n• Exercise regularly — aerobic activity strengthens respiratory muscles\n• Practice deep breathing exercises (diaphragmatic breathing)\n• Stay hydrated to keep mucus thin and mobile\n• Get vaccinated against influenza and pneumococcus\n• Maintain good indoor air quality (ventilation, air filters)\n\n**Avoid:**\n• Smoking and secondhand smoke (primary cause of COPD)\n• Prolonged exposure to dust, chemicals, and air pollutants\n• Ignoring persistent cough or breathlessness\n• High-altitude exertion without acclimatisation";
  }

  // Breathing exercises
  if (/breath|exercise|yoga|pranayam/.test(q)) {
    return "🌬️ **Breathing Exercises for Respiratory Health**\n\n**Diaphragmatic Breathing:**\n1. Lie on your back, knees bent\n2. Place one hand on your chest, one on your belly\n3. Breathe in through the nose for 4 counts — belly rises\n4. Breathe out through pursed lips for 8 counts\n\n**Pursed-Lip Breathing (especially for COPD):**\n1. Relax your shoulders\n2. Breathe in through the nose for 2 counts\n3. Pucker lips and breathe out slowly for 4 counts\n\n**4-7-8 Technique:**\nInhale 4 counts → Hold 7 counts → Exhale 8 counts\n\n⚕️ Always consult your doctor before starting new exercises if you have a lung condition.";
  }

  // Fallback
  return `I'm RespiNet's Health Advisor 🤖\n\nI can help you with:\n• **Disease info** — COPD, Pneumonia, Bronchiectasis, URTI, etc.\n• **Acoustic sounds** — crackles, wheezes, stridor\n• **AI technology** — MFCC, GRU networks, model accuracy\n• **Lung health tips** — prevention, breathing exercises\n• **Dataset info** — ICBHI 2017\n\nTry asking something like: _"What is COPD?"_ or _"How does MFCC work?"_\n\n⚕️ I do not provide personal medical advice or diagnoses.`;
}

// Simple markdown-lite renderer (bold, bullet)
function renderContent(text: string) {
  return text.split("\n").map((line, i) => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let last = 0,
      m: RegExpExecArray | null;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      parts.push(
        <strong
          key={m.index}
          style={{ color: "var(--text-primary)", fontWeight: 700 }}
        >
          {m[1]}
        </strong>,
      );
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <span key={i}>
        {parts.length ? parts : line}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    );
  });
}

export default function ChatPage() {
  const {
    messages,
    isTyping,
    addMessage,
    setTyping,
    updateMessage,
    clearChat,
  } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        role: "assistant",
        content: `Hello! I'm **RespiNet Health Advisor** 🫁\n\nI can answer questions about respiratory diseases, how RespiNet's AI works, lung health tips, and more.\n\nWhat would you like to know?`,
      });
    }
  }, []);

  const sendMessage = useCallback(
    async (text?: string) => {
      const q = (text ?? input).trim();
      if (!q) return;
      setInput("");
      addMessage({ role: "user", content: q });
      setTyping(true);
      const typingId = addMessage({
        role: "assistant",
        content: "",
        typing: true,
      });

      // Simulate thinking delay
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

      const response = buildResponse(q);
      updateMessage(typingId, response, false);
      setTyping(false);
    },
    [input, addMessage, setTyping, updateMessage],
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="chat-shell"
      style={{
        paddingTop: 64,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          maxWidth: 800,
          width: "100%",
          margin: "0 auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem 1.5rem 0",
        }}
      >
        {/* Header */}
        <motion.div
          className="page-intro chat-hero"
          initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <div
              className="section-tag"
              style={{ display: "inline-block", marginBottom: "0.4rem" }}
            >
              AI Powered
            </div>
            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              <span className="gradient-text">Research Info Guide</span>
            </h1>
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block",
                }}
              />
              Local rule-based content
            </div>
            <button
              onClick={clearChat}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
              title="Clear chat"
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>
        </motion.div>

        {/* Disclaimer banner */}
        <motion.div
          className="chat-disclaimer"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12 }}
          style={{
            padding: "0.65rem 1rem",
            borderRadius: "0.6rem",
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.2)",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginBottom: "1rem",
            lineHeight: 1.6,
          }}
        >
          ⚕️{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            Disclaimer:
          </strong>{" "}
          This chatbot provides educational information only. It does not
          constitute medical advice or diagnosis. Always consult a qualified
          healthcare professional.
        </motion.div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: "0.25rem",
            paddingBottom: "0.5rem",
          }}
        >
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "assistant" && !msg.typing ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    marginBottom: "1rem",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    className="chat-avatar"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#06b6d4,#6366f1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MessageCircle size={15} color="white" />
                  </div>
                  <div
                    className="chat-bubble chat-bubble-assistant"
                    style={{
                      maxWidth: "82%",
                      padding: "0.85rem 1rem",
                      borderRadius: "1rem 1rem 1rem 0.25rem",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      fontSize: "0.875rem",
                      lineHeight: 1.7,
                      color: "var(--text-primary)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {renderContent(msg.content)}
                  </div>
                  <div
                    className="chat-avatar is-thinking"
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-muted)",
                      marginBottom: 2,
                    }}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </motion.div>
              ) : msg.typing ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    marginBottom: "1rem",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    className="chat-bubble chat-bubble-assistant"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#06b6d4,#6366f1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MessageCircle size={15} color="white" />
                  </div>
                  <div
                    style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "1rem 1rem 1rem 0.25rem",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{ display: "flex", gap: 4, alignItems: "center" }}
                    >
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <ChatMessageBubble key={msg.id} message={msg} />
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggestion pills */}
        {messages.length <= 1 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
              marginBottom: "0.75rem",
            }}
          >
            {SUGGESTIONS.map((s) => (
              <motion.button
                key={s}
                onClick={() => sendMessage(s)}
                className="suggestion-pill"
                whileHover={{ y: -3, scale: 1.025 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: "0.35rem 0.85rem",
                  borderRadius: 999,
                  fontSize: "0.77rem",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.borderColor =
                    "var(--cyan-400)";
                  (e.target as HTMLElement).style.color = "var(--cyan-400)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.borderColor = "var(--border)";
                  (e.target as HTMLElement).style.color =
                    "var(--text-secondary)";
                }}
              >
                {s}
              </motion.button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <motion.div
          className="chat-composer"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          style={{
            display: "flex",
            gap: "0.75rem",
            padding: "0.75rem 0 1rem",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-primary)",
            position: "sticky",
            bottom: 0,
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about a respiratory disease, symptoms, or how the AI works…"
            disabled={isTyping}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--cyan-400)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
            className="btn-primary"
            style={{
              padding: "0.75rem 1.25rem",
              flexShrink: 0,
              opacity: !input.trim() || isTyping ? 0.5 : 1,
            }}
          >
            <Send size={16} />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
