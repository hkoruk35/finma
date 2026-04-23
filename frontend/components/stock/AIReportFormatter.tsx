import React from "react";

/**
 * Institutional Markdown Formatter (v5.5)
 * Detects headers, bold text, and lists to render a premium document.
 */
export default function AIReportFormatter({ content }: { content: string }) {
  if (!content) return null;

  // Clean redundant title if present at start
  const cleanContent = content.trim().replace(/^##\s+.*\n+/, '');
  const lines = cleanContent.split('\n');
  
  return (
    <div className="space-y-6">
      {lines.map((line, i) => {
        // Headers ###
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="text-lg md:text-xl font-black text-white uppercase tracking-widest pt-4 border-b border-white/5 pb-2">
              {line.replace('### ', '')}
            </h3>
          );
        }
        // Headers ##
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-xl md:text-2xl font-black text-[#3b82f6] uppercase tracking-tighter pt-2">
              {line.replace('## ', '')}
            </h2>
          );
        }
        // Bold Key/Value or Metric: **Key:** Value
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          const text = line.trim().substring(2);
          return (
            <div key={i} className="flex gap-3 pl-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] mt-2.5 shrink-0" />
              <p className="text-white text-base md:text-lg">{renderBold(text)}</p>
            </div>
          );
        }
        // Normal paragraphs
        if (line.trim().length > 0) {
          return (
            <p key={i} className="text-white leading-[1.8] text-base md:text-xl font-medium">
              {renderBold(line)}
            </p>
          );
        }
        return <div key={i} className="h-2" />;
      })}
    </div>
  );
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="text-white font-black px-1 rounded bg-white/5">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
