import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Lesson bodies are Markdown written by instructors. react-markdown renders to React elements and
// does not pass raw HTML through, so content can't inject scripts.
export function Markdown({ children, lang }: { children: string; lang?: string }) {
  return (
    <div lang={lang} className="flex flex-col gap-4 text-lg leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="mt-4 text-2xl font-bold text-foreground">{children}</h2>,
          h2: ({ children }) => <h2 className="mt-4 text-2xl font-bold text-foreground">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 text-xl font-bold text-foreground">{children}</h3>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="flex list-disc flex-col gap-2 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="flex list-decimal flex-col gap-2 pl-6">{children}</ol>,
          strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 bg-tint px-4 py-2">{children}</blockquote>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md bg-[#0b1230] p-4 font-mono text-sm leading-6 text-white [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-base">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border bg-muted px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border px-3 py-2">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}