function renderInlineMarkdown(text, keyPrefix) {
  return String(text || "")
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={key}>{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
}

export function MarkdownReport({ markdown, className = "scan-human-report-markdown" }) {
  const lines = String(markdown || "").split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;
  let codeFence = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      blocks.push(
        <p key={`p-${blocks.length}`}>{renderInlineMarkdown(text, `p-${blocks.length}`)}</p>
      );
    }
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>
    );
    list = [];
  };
  const flushCode = () => {
    blocks.push(
      <pre key={`code-${blocks.length}`}>
        <code>{code.join("\n")}</code>
      </pre>
    );
    code = [];
  };

  lines.forEach((line) => {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence && (!inCode || (fence[1][0] === codeFence[0] && fence[1].length >= codeFence.length && !fence[2].trim()))) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
        codeFence = fence[1];
      }
      return;
    }
    if (inCode) {
      code.push(line);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(6, Math.max(4, heading[1].length + 3));
      const Tag = `h${level}`;
      blocks.push(
        <Tag key={`h-${blocks.length}`}>
          {renderInlineMarkdown(heading[2].trim(), `h-${blocks.length}`)}
        </Tag>
      );
      return;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1].trim());
      return;
    }
    flushList();
    paragraph.push(line.trim());
  });

  if (inCode || code.length) flushCode();
  flushParagraph();
  flushList();

  return <div className={className}>{blocks}</div>;
}
