import React from 'react';

export function renderFormattedInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-zinc-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-xs border border-black/[0.05] dark:border-white/[0.08]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export const FormattedAIResponse: React.FC<{
  content: string;
  isStreaming?: boolean;
}> = ({ content, isStreaming }) => {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-[14px] leading-relaxed text-zinc-800 dark:text-zinc-100 font-normal">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-1.5" />;
        }

        // Heading 3 or 2
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={lineIdx} className="text-sm font-semibold text-zinc-900 dark:text-white pt-1">
              {renderFormattedInline(trimmed.replace(/^###\s+/, ''))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={lineIdx} className="text-base font-semibold text-zinc-900 dark:text-white pt-1.5">
              {renderFormattedInline(trimmed.replace(/^##\s+/, ''))}
            </h3>
          );
        }

        // Bullet list item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          const bulletText = trimmed.replace(/^[-*•]\s+/, '');
          return (
            <div key={lineIdx} className="flex items-start gap-2.5 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/80 dark:bg-blue-400 mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                {renderFormattedInline(bulletText)}
              </div>
            </div>
          );
        }

        // Numbered list item
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={lineIdx} className="flex items-start gap-2.5 pl-1">
              <span className="font-mono text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0 w-4 text-right">
                {numMatch[1]}.
              </span>
              <div className="flex-1 min-w-0">
                {renderFormattedInline(numMatch[2])}
              </div>
            </div>
          );
        }

        // Standard line / paragraph
        return (
          <p key={lineIdx} className="text-zinc-800 dark:text-zinc-100">
            {renderFormattedInline(line)}
            {isStreaming && lineIdx === lines.length - 1 && (
              <span className="inline-block w-1.5 h-4 ml-1 -mb-0.5 rounded-full bg-gradient-to-b from-[#0052FF] to-[#7928CA] animate-pulse" />
            )}
          </p>
        );
      })}
    </div>
  );
};
