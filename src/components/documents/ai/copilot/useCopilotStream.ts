import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RunOpts {
  action: string;
  selection?: string;
  fullText?: string;
  language?: string;
  documentId?: string | null;
  surface?: "document" | "presentation" | "spreadsheet";
  extraContext?: string;
}

interface RunResult {
  action: string;
  result: string;
  parsed: unknown;
  latency_ms: number;
}

/**
 * Hook pour appeler doc-ai-transform (actions unitaires).
 */
export function useCopilotTransform() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (opts: RunOpts): Promise<RunResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("doc-ai-transform", {
        body: {
          action: opts.action,
          selection: opts.selection,
          fullText: opts.fullText,
          language: opts.language,
          documentId: opts.documentId ?? null,
          surface: opts.surface ?? "document",
          extraContext: opts.extraContext,
        },
      });
      if (fnError) throw fnError;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as RunResult;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur IA";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { run, isLoading, error };
}

interface StreamOpts {
  messages: { role: "user" | "assistant"; content: string }[];
  documentTitle?: string;
  documentHtml?: string;
  contextSummary?: string;
  documentId?: string | null;
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

/**
 * Hook pour appeler doc-ai-copilot en streaming SSE via fetch direct
 * (functions.invoke ne supporte pas le streaming natif).
 */
export function useCopilotStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(async (opts: StreamOpts) => {
    stop();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expirée");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/doc-ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          messages: opts.messages,
          documentTitle: opts.documentTitle,
          documentHtml: opts.documentHtml,
          contextSummary: opts.contextSummary,
          documentId: opts.documentId ?? null,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Erreur ${res.status}: ${errBody || "aucun corps"}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            opts.onDone();
            continue;
          }
          try {
            const json = JSON.parse(payload) as { delta?: string; error?: string };
            if (json.error) {
              opts.onError(json.error);
              continue;
            }
            if (typeof json.delta === "string") opts.onDelta(json.delta);
          } catch {
            // skip
          }
        }
      }
      opts.onDone();
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      opts.onError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [stop]);

  return { start, stop, isStreaming };
}
