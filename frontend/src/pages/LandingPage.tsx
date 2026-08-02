import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { useInView as useIntersectionObserver } from 'react-intersection-observer';
import Activity from 'lucide-react/dist/esm/icons/activity.js';
import FileAudio from 'lucide-react/dist/esm/icons/file-audio.js';
import Cpu from 'lucide-react/dist/esm/icons/cpu.js';
import FileText from 'lucide-react/dist/esm/icons/file-text.js';
import Database from 'lucide-react/dist/esm/icons/database.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import BarChart from 'lucide-react/dist/esm/icons/bar-chart.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import Info from 'lucide-react/dist/esm/icons/info.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import GitBranch from 'lucide-react/dist/esm/icons/git-branch.js';
import Stethoscope from 'lucide-react/dist/esm/icons/stethoscope.js';

import './LandingPage.css';

const useCountUp = (end: number, duration: number = 2) => {
  const [count, setCount] = useState(0);
  const { ref, inView } = useIntersectionObserver({ threshold: 0.1, triggerOnce: true });

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    if (inView) {
      window.requestAnimationFrame(step);
    }
  }, [inView, end, duration]);

  return { count, ref };
};

const AnimatedWaveform = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.05;

      const waves = [
        { amplitude: 40, frequency: 0.01, speed: 0.05, color: 'rgba(47, 71, 125, 0.2)' }, // Indigo
        { amplitude: 60, frequency: 0.008, speed: 0.04, color: 'rgba(85, 123, 105, 0.15)' }, // Moss
        { amplitude: 30, frequency: 0.015, speed: 0.06, color: 'rgba(108, 166, 193, 0.25)' }, // Sky
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 10) {
          const y =
            canvas.height / 2 +
            Math.sin(x * wave.frequency + time * wave.speed) * wave.amplitude * Math.sin(x * 0.001);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.fillStyle = wave.color;
        ctx.fill();
        ctx.closePath();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-canvas" />;
};

const FadeInWhenVisible = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => {
  const controls = useAnimation();
  const [ref, inView] = useIntersectionObserver({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  return (
    <motion.div
      ref={ref}
      animate={controls}
      initial="hidden"
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      variants={{
        visible: { opacity: 1, y: 0 },
        hidden: { opacity: 0, y: 30 }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};


const StatCard = ({ end, label, suffix = "" }: { end: number; label: string; suffix?: string }) => {
  const { count, ref } = useCountUp(end, 2.5);
  return (
    <div className="stat-card" ref={ref}>
      <div className="stat-value">{count}{suffix}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
};

export const LandingPage = () => {
  const heroTitle = "Respiratory patterns, decoded.";
  
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <AnimatedWaveform />
        <div className="hero-content">
          <div className="hero-badge">
            <Info size={14} />
            <span>Research prototype — not a diagnostic device</span>
          </div>
          
          <h1 className="hero-title">
            {heroTitle.split(" ").map((word, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                style={{ display: "inline-block", marginRight: "0.25em" }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
          
          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
          >
            Analyze respiratory recordings with deep neural networks. A research prototype exploring audio-based pattern recognition.
          </motion.p>

          <motion.div 
            className="hero-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <Link to="/analyze" className="btn-primary">
              <Play size={18} />
              Start analyzing
            </Link>
            <Link to="/evidence" className="btn-secondary">
              <FileText size={18} />
              View evidence
            </Link>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <FadeInWhenVisible>
          <div className="section-header">
            <h2>The analysis pipeline</h2>
            <p>From raw audio to interpreted patterns in three steps.</p>
          </div>
        </FadeInWhenVisible>

        <div className="steps-container">
          {[
            { 
              step: 1, 
              title: "Upload or record", 
              desc: "Upload audio files or record directly in the browser.",
              icon: <FileAudio size={32} />
            },
            { 
              step: 2, 
              title: "Analyze patterns", 
              desc: "Conv1D + BiGRU model processes 40 MFCC features.",
              icon: <Activity size={32} />
            },
            { 
              step: 3, 
              title: "Read the evidence", 
              desc: "Review uncalibrated model scores with full context.",
              icon: <BarChart size={32} />
            }
          ].map((item, index) => (
            <FadeInWhenVisible key={item.step} delay={index * 0.2} className="step-card">
              <div className="step-number">{item.step}</div>
              <div className="step-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </FadeInWhenVisible>
          ))}
          <div className="steps-connector"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <FadeInWhenVisible>
          <div className="section-header">
            <h2>Platform Capabilities</h2>
            <p>Comprehensive tools for respiratory audio analysis.</p>
          </div>
        </FadeInWhenVisible>

        <div className="features-grid">
          {[
            { title: "Real-time audio visualization", desc: "Interactive waveform and spectrogram rendering.", icon: <Activity size={24} /> },
            { title: "8 respiratory condition patterns", desc: "Identify distinctive adventitious sound labels.", icon: <Stethoscope size={24} /> },
            { title: "Experimental attribution maps", desc: "Saliency/Grad-CAM overlays on spectrograms.", icon: <Eye size={24} /> },
            { title: "Research-grade AI summaries", desc: "LLM integration for contextual interpretation.", icon: <FileText size={24} /> },
            { title: "ICBHI dataset integration", desc: "Trained on 920 robust clinical recordings.", icon: <Database size={24} /> },
            { title: "Privacy-first design", desc: "In-browser processing. No audio data stored.", icon: <Shield size={24} /> }
          ].map((feature, i) => (
            <FadeInWhenVisible key={i} delay={i * 0.1}>
              <motion.div 
                className="feature-card"
                whileHover={{ y: -8, boxShadow: "0 12px 24px rgba(23, 33, 30, 0.08)" }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="feature-icon-wrapper">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </motion.div>
            </FadeInWhenVisible>
          ))}
        </div>
      </section>

      {/* Statistics Section */}
      <section className="stats-section">
        <div className="stats-grid">
          <StatCard end={8} label="Disease Categories" />
          <StatCard end={920} label="Recordings Analyzed" suffix="+" />
          <StatCard end={40} label="MFCC Features Extracted" />
          <StatCard end={137} label="Model Parameters" suffix="K" />
        </div>
      </section>

      {/* Disease Categories Preview */}
      <section className="categories-section">
        <FadeInWhenVisible>
          <div className="section-header">
            <h2>Condition Categories</h2>
            <p>The model detects patterns associated with these clinical classifications.</p>
          </div>
        </FadeInWhenVisible>
        
        <div className="categories-grid">
          {["Asthma", "Bronchiectasis", "Bronchiolitis", "COPD", "No adventitious sound label", "LRTI", "Pneumonia", "URTI"].map((disease, i) => (
            <motion.div 
              key={disease}
              className="category-card"
              whileHover={{ rotate: 1, scale: 1.02, y: -5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="category-header">
                <Stethoscope size={20} className="category-icon" />
                <h4>{disease}</h4>
              </div>
              <p>Recognizing acoustic signatures indicative of {disease.toLowerCase()} pathology.</p>
              <Link to="/learn" className="category-link">Learn more <ChevronRight size={14} /></Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Technology Stack Section */}
      <section className="tech-section">
        <FadeInWhenVisible>
          <div className="section-header">
            <h2>Neural Architecture</h2>
            <p>A specialized pipeline for sequential audio data.</p>
          </div>
        </FadeInWhenVisible>

        <div className="pipeline-visual">
          {["Audio", "MFCC", "Conv1D", "BiGRU", "Softmax"].map((stage, i) => (
            <React.Fragment key={stage}>
              <motion.div 
                className="pipeline-stage"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
              >
                <Cpu size={24} />
                <span>{stage}</span>
              </motion.div>
              {i < 4 && (
                <motion.div 
                  className="pipeline-arrow"
                  initial={{ width: 0 }}
                  whileInView={{ width: 40 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 + 0.1 }}
                >
                  <ChevronRight size={20} />
                </motion.div>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <FadeInWhenVisible className="cta-content">
          <h2>Begin your research analysis</h2>
          <p>Upload a stethoscope recording or use the device microphone to evaluate uncalibrated model scores.</p>
          <Link to="/analyze" className="btn-primary btn-large">
            <Activity size={20} />
            Analyze recording
          </Link>
          <div className="cta-disclaimer">
            <Shield size={14} />
            <span>Research prototype — not a diagnostic device. Do not use for medical decisions.</span>
          </div>
        </FadeInWhenVisible>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-col">
            <h3>RespiNet</h3>
            <p>Deep neural network for respiratory sound classification.</p>
            <div className="footer-disclaimer">
              <Info size={14} /> Research prototype — not a diagnostic device
            </div>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <Link to="/evidence">Evidence</Link>
            <Link to="/learn">Learn</Link>
            <a href="#glossary">Glossary</a>
          </div>
          <div className="footer-col">
            <h4>Project</h4>
            <a href="https://github.com"><GitBranch size={16} /> GitHub</a>
            <span className="credit">Trained on ICBHI 2017 Dataset</span>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} RespiNet Project. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
