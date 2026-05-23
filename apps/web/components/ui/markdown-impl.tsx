import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const schema = {
  ...defaultSchema,
  tagNames: ["p", "strong", "em", "a", "ul", "ol", "li", "code", "br"],
  attributes: {
    ...defaultSchema.attributes,
    a: ["href", "title", "rel", "target"],
  },
};

export default function MarkdownImpl({ source }: { source: string }) {
  return (
    <div className="max-w-none space-y-4 text-ink leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-coral-deep underline underline-offset-2"
            >
              {children}
            </a>
          ),
          p: ({ children }) => <p>{children}</p>,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
