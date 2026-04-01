import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown with GFM tables/strikethrough, math (KaTeX), and
 * syntax-highlighted code blocks. Uses CSS vars for theming.
 */
export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  if (!content) {
    return (
      <p
        className={cn("text-sm italic", className)}
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Nothing to preview yet.
      </p>
    );
  }

  return (
    <div
      className={cn("prose-custom text-sm leading-relaxed", className)}
      style={{ color: "var(--color-foreground)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1
              className="text-xl font-bold mb-3 mt-4"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className="text-lg font-semibold mb-2 mt-3"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="text-base font-semibold mb-2 mt-3"
              style={{ color: "var(--color-foreground)" }}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-3" style={{ color: "var(--color-foreground)" }}>
              {children}
            </p>
          ),
          code: ({ className: cls, children, ...props }) => {
            const isBlock = cls?.startsWith("language-");
            if (isBlock) {
              return (
                <code
                  className={cn(cls, "block text-xs rounded p-3 overflow-x-auto")}
                  style={{
                    background: "var(--color-muted)",
                    fontFamily: "var(--font-code, monospace)",
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--color-muted)",
                  fontFamily: "var(--font-code, monospace)",
                  color: "var(--color-foreground)",
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ color: "var(--color-foreground)" }}>{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="border-l-4 pl-4 italic my-3"
              style={{
                borderColor: "var(--color-primary)",
                color: "var(--color-muted-foreground)",
              }}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="underline"
              style={{ color: "var(--color-primary)" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="max-w-full rounded my-2" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
