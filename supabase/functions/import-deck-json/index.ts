import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface DeckLabel {
  id: number;
  title: string;
  color: string;
  boardId: number;
}

interface DeckCard {
  id: number;
  title: string;
  description: string;
  stackId: number;
  labels: DeckLabel[];
  assignedUsers: { participant: { displayname: string } }[];
  order: number;
  archived: boolean;
  duedate?: string;
}

interface DeckStack {
  id: number;
  title: string;
  cards: DeckCard[];
}

interface DeckBoard {
  id: number;
  title: string;
  color: string;
  labels: DeckLabel[];
  stacks: Record<string, DeckStack>;
}

interface DeckExport {
  boards: DeckBoard[];
}

// Map Deck stack titles to our statuses
const stackToStatus: Record<string, string> = {
  "à faire": "backlog",
  "a faire": "backlog",
  "backlog": "backlog",
  "planifiée": "todo",
  "planifie": "todo",
  "to do": "todo",
  "en cours": "in_progress",
  "doing": "in_progress",
  "in progress": "in_progress",
  "review": "review",
  "révision": "review",
  "à réviser": "review",
  "terminé": "done",
  "termine": "done",
  "done": "done",
  "fait": "done",
};

// Map Deck label titles to priority
const labelToPriority: Record<string, string> = {
  "action requise": "high",
  "urgent": "critical",
  "critique": "critical",
  "bug": "high",
  "amélioration": "medium",
  "plus tard": "low",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { deckData, projetId }: { deckData: DeckExport; projetId?: string } = await req.json();

    if (!deckData || !deckData.boards || deckData.boards.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid Deck JSON data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const board of deckData.boards) {
      console.log(`Processing board: ${board.title}`);

      // 1. Create or use existing project
      let projectId = projetId;
      
      if (!projectId) {
        const { data: project, error: projectError } = await supabaseClient
          .from("rd_projets")
          .insert({
            nom: board.title,
            description: `Importé depuis Nextcloud Deck`,
            couleur: `#${board.color}`,
            statut: "actif",
          })
          .select()
          .single();

        if (projectError) {
          console.error("Error creating project:", projectError);
          throw projectError;
        }
        projectId = project.id;
      }

      // 2. Create epics from labels (non-status labels)
      const statusLabels = ["terminé", "à réviser", "action requise", "plus tard"];
      const epicLabels = board.labels.filter(
        (l) => !statusLabels.some((s) => l.title.toLowerCase().includes(s.toLowerCase()))
      );

      const epicMap = new Map<number, string>();
      
      for (const label of epicLabels) {
        const { data: epic, error: epicError } = await supabaseClient
          .from("rd_epics")
          .insert({
            projet_id: projectId,
            titre: label.title,
            couleur: `#${label.color}`,
            priorite: "medium",
          })
          .select()
          .single();

        if (!epicError && epic) {
          epicMap.set(label.id, epic.id);
        }
      }

      // 3. Process stacks and cards
      let storiesCreated = 0;
      
      const stacks = Object.values(board.stacks || {});
      
      for (const stack of stacks) {
        const stackTitleLower = stack.title.toLowerCase();
        const status = stackToStatus[stackTitleLower] || "backlog";

        for (const card of stack.cards || []) {
          if (card.archived) continue;

          // Determine epic from card labels
          const cardEpicLabel = card.labels?.find((l) => epicMap.has(l.id));
          const epicId = cardEpicLabel ? epicMap.get(cardEpicLabel.id) : null;

          // Determine priority from card labels
          let priority = "medium";
          for (const label of card.labels || []) {
            const labelLower = label.title.toLowerCase();
            if (labelToPriority[labelLower]) {
              priority = labelToPriority[labelLower];
              break;
            }
          }

          // Create user story
          const { error: storyError } = await supabaseClient
            .from("rd_user_stories")
            .insert({
              projet_id: projectId,
              epic_id: epicId,
              titre: card.title,
              description: card.description || null,
              statut: status,
              priorite: priority,
              ordre: card.order || 999,
            });

          if (!storyError) {
            storiesCreated++;
          } else {
            console.error("Error creating story:", storyError, card.title);
          }
        }
      }

      results.push({
        board: board.title,
        projectId,
        epicsCreated: epicMap.size,
        storiesCreated,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Import terminé`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Import error:", error);
    return buildErrorResponse('import-deck-json', error, corsHeaders, 500);
  }
});
