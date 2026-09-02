import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface QuotableMessage {
  from_name?: string;
  from_address: string;
  body_text?: string;
  sent_date: string;
}

/**
 * Build a quoted body from thread messages for email replies.
 * Messages should be sorted newest-first (as they come from the thread).
 * Only includes the last 5 messages max to avoid huge bodies.
 */
export function buildQuotedBody(messages: QuotableMessage[], maxMessages = 5): string {
  if (!messages || messages.length === 0) return "";

  // Take the most recent messages (already sorted newest-first)
  const toQuote = messages.slice(0, maxMessages);

  const parts: string[] = [];

  for (let i = 0; i < toQuote.length; i++) {
    const msg = toQuote[i];
    const depth = i + 1; // nesting level
    const prefix = ">".repeat(depth) + " ";

    const sender = msg.from_name || msg.from_address;
    const dateStr = formatMessageDate(msg.sent_date);
    const bodyLines = (msg.body_text || "").split("\n");

    parts.push("");
    parts.push(`${">"
      .repeat(Math.max(depth - 1, 1))} Le ${dateStr}, ${sender} a écrit :`);
    
    for (const line of bodyLines) {
      parts.push(`${prefix}${line}`);
    }
  }

  return parts.join("\n");
}

function formatMessageDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return dateStr;
  }
}
