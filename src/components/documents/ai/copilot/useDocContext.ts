import { useMemo } from "react";

/**
 * Contexte projet passé au Copilot (résumé texte simple).
 * MVP: extrait un résumé du contenu courant du document + méta.
 * V2 (à brancher): pull données CRM/RH/tréso selon documentId/folderId.
 */
export function useDocContext(opts: {
  documentName?: string;
  documentHtml?: string;
  folderId?: string | null;
}): { summary: string; title: string } {
  const { documentName = "Sans titre", documentHtml = "", folderId } = opts;

  const summary = useMemo(() => {
    const plain = documentHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = plain.split(" ").filter(Boolean);
    const wordCount = words.length;
    const preview = words.slice(0, 60).join(" ");
    const bits = [
      `Titre: ${documentName}`,
      folderId ? `Dossier: ${folderId}` : "Dossier: (racine)",
      `Longueur: ${wordCount} mots`,
      preview ? `Extrait: ${preview}${wordCount > 60 ? "…" : ""}` : "",
    ].filter(Boolean);
    return bits.join("\n");
  }, [documentName, documentHtml, folderId]);

  return { summary, title: documentName };
}
