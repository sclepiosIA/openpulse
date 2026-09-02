import { useMemo } from "react";
import DOMPurify from "dompurify";

interface SafeHtmlContentProps {
  html: string;
  className?: string;
}

export function SafeHtmlContent({ html, className = "" }: SafeHtmlContentProps) {
  const sanitizedHtml = useMemo(() => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
      ALLOWED_ATTR: ['href', 'title', 'class', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'base', 'object', 'embed', 'link', 'meta', 'svg', 'math', 'input', 'button', 'select', 'textarea'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange', 'formaction'],
      SANITIZE_DOM: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false
    });
  }, [html]);

  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
      // safe: sanitizedHtml is produced via DOMPurify with a strict allow-list above
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
