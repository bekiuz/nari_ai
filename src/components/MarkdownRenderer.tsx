import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
}

// Lightweight syntax highlighter for common developer languages
function highlightCode(code: string, _lang: string): string {
  // Escape HTML entities first
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Common keywords across TS/JS, Python, Go, Rust, Java, C++, SQL
  const keywords = /\b(const|let|var|function|return|import|export|from|default|class|interface|type|extends|implements|if|else|for|while|switch|case|break|try|catch|finally|async|await|def|None|True|False|self|print|struct|fn|pub|mut|impl|package|select|WHERE|SELECT|INSERT|UPDATE|DELETE|JOIN|GROUP BY|ORDER BY)\b/g;
  const strings = /(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`|"(?:\\"|[^"])*"|'(?:\\'|[^'])*')/g;
  const comments = /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)/gm;
  const numbers = /\b(\d+(\.\d+)?)\b/g;

  escaped = escaped
    .replace(comments, '<span class="text-slate-500 italic">$1</span>')
    .replace(strings, '<span class="text-emerald-300">$1</span>')
    .replace(keywords, '<span class="text-pink-400 font-medium">$1</span>')
    .replace(numbers, '<span class="text-amber-300 font-mono">$1</span>');

  return escaped;
}

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const highlightedHtml = highlightCode(code, language);
  const cleanLang = (language || 'code').toLowerCase();

  return (
    <div className="my-3.5 rounded-xl overflow-hidden border border-[#23173d] bg-[#07050e] shadow-xl">
      {/* Code console header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#1b122f] bg-[#0f0a1c] text-xs text-slate-300">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-3.5 h-3.5 text-pink-400" />
          <span className="font-mono text-[11px] font-medium tracking-wide text-slate-300 uppercase">
            {cleanLang}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#19102c] hover:bg-[#23153d] border border-[#281745] text-slate-300 hover:text-white transition-all text-[11px] font-mono cursor-pointer"
          title="Copy code"
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <div className="p-3.5 overflow-x-auto text-[13px] font-mono leading-relaxed text-slate-200 selection:bg-pink-500/25">
        <pre className="m-0">
          <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </pre>
      </div>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Parse content into code blocks and normal markdown segments
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      const parsedHtml = marked.parse(textBefore, { breaks: true, gfm: true }) as string;
      parts.push(
        <div
          key={`md-${lastIndex}`}
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: parsedHtml }}
        />
      );
    }

    const language = match[1] || '';
    const code = match[2];
    parts.push(
      <CodeBlock key={`code-${match.index}`} code={code} language={language} />
    );

    lastIndex = match.index + match[0].length;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText.trim()) {
    const parsedHtml = marked.parse(remainingText, { breaks: true, gfm: true }) as string;
    parts.push(
      <div
        key={`md-end-${lastIndex}`}
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: parsedHtml }}
      />
    );
  }

  return <div className="space-y-1.5 text-sm leading-relaxed">{parts}</div>;
};
