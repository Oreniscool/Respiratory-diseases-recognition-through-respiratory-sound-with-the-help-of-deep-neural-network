import React from "react";

interface FormattedTextProps {
  content: string;
  className?: string;
}

/**
 * Cleanly renders markdown-style text from LLM outputs into structured HTML elements.
 */
export default function FormattedText({ content, className = "generated-formatted-content" }: FormattedTextProps) {
  if (!content) return null;

  // Clean raw string (strip outer quotes or markdown code blocks if any)
  let cleanText = content.trim();
  if (cleanText.startsWith("```") && cleanText.endsWith("```")) {
    cleanText = cleanText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  if ((cleanText.startsWith('"') && cleanText.endsWith('"')) || (cleanText.startsWith("'") && cleanText.endsWith("'"))) {
    cleanText = cleanText.slice(1, -1).trim();
  }

  const lines = cleanText.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = (keyPrefix: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${keyPrefix}-${elements.length}`} className="formatted-list">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  const renderInlineBold = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(String(index));
      return;
    }

    // Skip conversational preamble lines (e.g. "Here is a summary...")
    if (/^(here is|below is|this is|sure|here's)\s+a?\s*(summary|explanation|report|non-diagnostic|breakdown)/i.test(trimmed)) {
      return;
    }

    // Bullet point line
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      const itemText = trimmed.replace(/^[-*•]\s+/, "");
      currentList.push(
        <li key={`li-${index}`}>
          {renderInlineBold(itemText)}
        </li>
      );
      return;
    }

    // If we reach a non-bullet line, flush active bullet list
    flushList(String(index));

    // Heading line (starts with # or ends with :)
    if (trimmed.startsWith("#")) {
      const headingText = trimmed.replace(/^#+\s*/, "");
      elements.push(
        <h4 key={`h4-${index}`} className="formatted-heading">
          {renderInlineBold(headingText)}
        </h4>
      );
    } else if (/^[A-Z][A-Za-z0-9\s]{2,30}:$/.test(trimmed)) {
      elements.push(
        <h4 key={`h4-${index}`} className="formatted-heading">
          {trimmed.slice(0, -1)}
        </h4>
      );
    } else {
      elements.push(
        <p key={`p-${index}`} className="formatted-paragraph">
          {renderInlineBold(trimmed)}
        </p>
      );
    }
  });

  flushList("end");

  return <div className={className}>{elements}</div>;
}
