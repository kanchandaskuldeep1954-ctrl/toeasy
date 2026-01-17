import React from 'react';

/**
 * Converts markdown text to React elements with proper formatting
 * Handles: **bold**, *italic*, numbered lists, bullet points, headers
 */
export const renderMarkdown = (text: string): React.ReactNode[] => {
  if (!text) return [];

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} className="h-2"></div>);
      i++;
      continue;
    }

    // Numbered list items (1., 2., etc.)
    if (/^\d+\./.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s*(.*)/);
      if (match) {
        const content = match[1];
        elements.push(
          <div key={`list-${i}`} className="flex gap-3 items-start ml-2">
            <span className="text-indigo-600 dark:text-indigo-400 font-black text-sm flex-shrink-0 mt-0.5">●</span>
            <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {renderInlineMarkdown(content)}
            </span>
          </div>
        );
      }
      i++;
      continue;
    }

    // Bullet points (*, -)
    if (/^[\*\-]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[\*\-]\s+/, '');
      elements.push(
        <div key={`bullet-${i}`} className="flex gap-3 items-start ml-2">
          <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm flex-shrink-0 mt-0.5">✓</span>
          <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {renderInlineMarkdown(content)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // Headers (###, ##, #)
    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const content = trimmed.replace(/^#+\s+/, '');
      const sizes = {
        1: 'text-lg font-black',
        2: 'text-base font-black',
        3: 'text-sm font-black'
      };
      elements.push(
        <h4 
          key={`header-${i}`} 
          className={`${sizes[level as keyof typeof sizes]} text-indigo-700 dark:text-indigo-400 mt-3 mb-2 uppercase tracking-wider`}
        >
          {renderInlineMarkdown(content)}
        </h4>
      );
      i++;
      continue;
    }

    // Regular paragraphs
    elements.push(
      <p 
        key={`para-${i}`} 
        className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
      >
        {renderInlineMarkdown(trimmed)}
      </p>
    );

    i++;
  }

  return elements;
};

/**
 * Renders inline markdown formatting: **bold**, *italic*, etc.
 */
export const renderInlineMarkdown = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // Regex to find **bold**, *italic*, `code`
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add formatted text
    if (match[1]) {
      // **bold**
      parts.push(
        <strong key={`bold-${key++}`} className="font-black text-indigo-700 dark:text-indigo-400">
          {match[1]}
        </strong>
      );
    } else if (match[2]) {
      // *italic*
      parts.push(
        <em key={`italic-${key++}`} className="italic text-slate-600 dark:text-slate-400">
          {match[2]}
        </em>
      );
    } else if (match[3]) {
      // `code`
      parts.push(
        <code 
          key={`code-${key++}`} 
          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-rose-600 dark:text-rose-400"
        >
          {match[3]}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

/**
 * Component wrapper for rendered markdown
 */
export const MarkdownContent: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {renderMarkdown(content)}
    </div>
  );
};
