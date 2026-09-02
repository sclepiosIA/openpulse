/**
 * GET /platform-clients?etab_id=<uuid>
 * Returns the canonical client record.
 */
import { withApiKey, jsonResponse, errorResponse, serviceClient } from "../_shared/platform-auth.ts";

Deno.serve(async (req) =>
  withApiKey(req, async (ctx) => {
    // Scope check: only real (non-sandbox) platform integrations may read client business data.
    const allowedScopes = ["platform:site_web", "platform:product"];
    if (!ctx.scope || !allowedScopes.includes(ctx.scope)) {
      return errorResponse("Forbidden — scope mismatch", 403, "scope_mismatch");
    }
    const url = new URL(req.url);
    const etabId = url.searchParams.get("etab_id") ?? url.pathname.split("/").pop();
    if (!etabId || !/^[0-9a-f-]{36}$/i.test(etabId)) {
      return errorResponse("Invalid etab_id", 400, "invalid_param");
    }
    const sb = serviceClient();
    const { data: etab, error } = await sb
      .from("etablissements")
      .select("id, nom, siret, ville, statut, pallier_vise")
      .eq("id", etabId)
      .maybeSingle();
    if (error) return errorResponse("Lookup failed", 500, "db_error");
    if (!etab) return errorResponse("Client not found", 404, "not_found");

    const { data: links } = await sb
      .from("client_external_ids")
      .select("system, external_id")
      .eq("etablissement_id", etabId);

    const provisioned = {
      site_web: !!links?.find((l) => l.system === "site_web"),
      product: !!links?.find((l) => l.system === "product"),
    };

    return jsonResponse({
      etablissement_id: etab.id,
      nom: etab.nom,
      siret: etab.siret,
      ville: etab.ville,
      statut: etab.statut,
      plan: etab.pallier_vise ? String(etab.pallier_vise) : null,
      modules_actifs: [],
      contacts_admin: [],
      provisioned,
    });
  }),
);
