import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right.js";
import BookOpen from "lucide-react/dist/esm/icons/book-open.js";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.js";
import CircleAlert from "lucide-react/dist/esm/icons/circle-alert.js";
import Search from "lucide-react/dist/esm/icons/search.js";
import Stethoscope from "lucide-react/dist/esm/icons/stethoscope.js";
import Volume2 from "lucide-react/dist/esm/icons/volume-2.js";
import { GLOSSARY, REFERENCE_ENTRIES, type ReferenceEntry } from "../data/referenceContent";

export default function LearnPage() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>("copd");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return REFERENCE_ENTRIES;
    return REFERENCE_ENTRIES.filter((entry) =>
      [entry.name, entry.shortName, entry.eyebrow, entry.summary, ...entry.commonSigns]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  return (
    <div className="editorial-page learn-page">
      <motion.header
        className="editorial-hero learn-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <p className="eyebrow">Respiratory reference</p>
          <h1>Learn what the labels mean—and where they stop.</h1>
          <p className="hero-deck">
            Plain-language context for the project’s eight labels, grounded in public health and respiratory sources. A sound can be an observation; it is never a diagnosis by itself.
          </p>
        </div>
        <div className="learn-callout">
          <CircleAlert aria-hidden="true" />
          <div><strong>General information only</strong><p>This library does not interpret personal symptoms, recommend treatment, or replace professional assessment.</p></div>
        </div>
      </motion.header>

      <div className="reference-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Search the respiratory reference</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a condition, sound, or symptom" />
        </label>
        <span>{filtered.length} reference {filtered.length === 1 ? "entry" : "entries"}</span>
      </div>

      <section className="reference-list" aria-label="Respiratory reference entries">
        <AnimatePresence>
          {filtered.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <ReferenceRow
                entry={entry}
                open={openId === entry.id}
                onToggle={() => setOpenId((current) => current === entry.id ? null : entry.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {!filtered.length && (
          <motion.div 
            className="no-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search aria-hidden="true" /><h2>No matching reference</h2><p>Try a broader term such as “wheeze”, “infection”, or “cough”.</p>
          </motion.div>
        )}
      </section>

      <section className="glossary-section" id="glossary">
        <div className="section-intro">
          <p className="eyebrow">Glossary</p>
          <h2>Words used in respiratory-sound research</h2>
          <p>These definitions keep acoustic observations separate from clinical conclusions.</p>
        </div>
        <dl className="glossary-list">
          {GLOSSARY.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>)}
        </dl>
        <a className="text-link" href="https://publications.ersnet.org/content/erj/47/3/724" target="_blank" rel="noreferrer">
          Read the ERS task-force terminology paper <ArrowUpRight size={16} />
        </a>
      </section>
    </div>
  );
}

function ReferenceRow({ entry, open, onToggle }: { entry: ReferenceEntry; open: boolean; onToggle: () => void }) {
  return (
    <article className={`reference-entry${open ? " is-open" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`${entry.id}-content`}>
        <span className="reference-index"><BookOpen aria-hidden="true" /></span>
        <span className="reference-title"><small>{entry.eyebrow}</small><strong>{entry.name}</strong>{entry.shortName && <em>{entry.shortName}</em>}</span>
        <span className="reference-summary">{entry.summary}</span>
        <ChevronDown className="reference-chevron" aria-hidden="true" />
      </button>
      <AnimatePresence>
      {open && (
        <motion.div
          className="reference-content"
          id={`${entry.id}-content`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{ overflow: "hidden" }}
        >
          <div className="reference-block">
            <Stethoscope aria-hidden="true" />
            <div><h3>Commonly described signs</h3><ul>{entry.commonSigns.map((sign) => <li key={sign}>{sign}</li>)}</ul></div>
          </div>
          <div className="reference-block">
            <Volume2 aria-hidden="true" />
            <div><h3>Sound context</h3><p>{entry.soundNote}</p></div>
          </div>
          <div className="reference-block reference-assessment">
            <CircleAlert aria-hidden="true" />
            <div><h3>Assessment boundary</h3><p>{entry.assessment}</p></div>
          </div>
          <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceLabel}<ArrowUpRight size={16} aria-hidden="true" /></a>
        </motion.div>
      )}
      </AnimatePresence>
    </article>
  );
}
