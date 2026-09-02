import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { checkRateLimit, extractClientIp, rateLimitedResponse } from "../_shared/rate-limit.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "OpenPulse API",
    description: "API publique pour intégrer OpenPulse avec vos systèmes.",
    version: "1.0.0",
    contact: {
      name: "Support OpenPulse",
      email: "support@exploitant.example.org",
    },
  },
  servers: [
    {
      url: "https://your-project-ref.supabase.co/functions/v1",
      description: "Production",
    },
  ],
  security: [
    { bearerAuth: [] },
    { apiKey: [] },
  ],
  paths: {
    "/api-v1/etablissements": {
      get: {
        summary: "Lister les établissements",
        description: "Récupère la liste des établissements accessibles.",
        tags: ["Établissements"],
        parameters: [
          {
            name: "statut",
            in: "query",
            schema: { type: "string", enum: ["prospect", "contractuel", "deploiement", "production", "churned"] },
            description: "Filtrer par statut",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50 },
            description: "Nombre maximum de résultats",
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
            description: "Décalage pour la pagination",
          },
        ],
        responses: {
          "200": {
            description: "Liste des établissements",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Etablissement" },
                    },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        summary: "Créer un établissement",
        description: "Crée un nouvel établissement (prospect).",
        tags: ["Établissements"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EtablissementCreate" },
            },
          },
        },
        responses: {
          "201": {
            description: "Établissement créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Etablissement" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api-v1/etablissements/{id}": {
      get: {
        summary: "Récupérer un établissement",
        tags: ["Établissements"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Détails de l'établissement",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Etablissement" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        summary: "Mettre à jour un établissement",
        tags: ["Établissements"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EtablissementUpdate" },
            },
          },
        },
        responses: {
          "200": { description: "Établissement mis à jour" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api-v1/contacts": {
      get: {
        summary: "Lister les contacts",
        tags: ["Contacts"],
        parameters: [
          {
            name: "etablissement_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Liste des contacts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Contact" },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Créer un contact",
        tags: ["Contacts"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ContactCreate" },
            },
          },
        },
        responses: {
          "201": { description: "Contact créé" },
        },
      },
    },
    "/api-v1/factures": {
      get: {
        summary: "Lister les factures",
        tags: ["Facturation"],
        parameters: [
          {
            name: "etablissement_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "statut",
            in: "query",
            schema: { type: "string", enum: ["brouillon", "envoyee", "payee", "annulee"] },
          },
        ],
        responses: {
          "200": {
            description: "Liste des factures",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Facture" },
                },
              },
            },
          },
        },
      },
    },
    "/api-v1/taches": {
      get: {
        summary: "Lister les tâches",
        tags: ["Tâches"],
        parameters: [
          {
            name: "etablissement_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "assignee_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "statut",
            in: "query",
            schema: { type: "string", enum: ["a_faire", "en_cours", "terminee", "annulee"] },
          },
        ],
        responses: {
          "200": {
            description: "Liste des tâches",
          },
        },
      },
      post: {
        summary: "Créer une tâche",
        tags: ["Tâches"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TacheCreate" },
            },
          },
        },
        responses: {
          "201": { description: "Tâche créée" },
        },
      },
    },
    "/api-v1/webhooks": {
      post: {
        summary: "Enregistrer un webhook",
        description: "Enregistre une URL pour recevoir des événements.",
        tags: ["Webhooks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "events"],
                properties: {
                  url: { type: "string", format: "uri" },
                  events: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "etablissement.created",
                        "etablissement.updated",
                        "etablissement.status_changed",
                        "contact.created",
                        "tache.created",
                        "tache.completed",
                        "facture.created",
                        "facture.paid",
                      ],
                    },
                  },
                  secret: { type: "string", description: "Secret pour signer les webhooks" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Webhook enregistré",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    url: { type: "string" },
                    events: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api-v1-tickets": {
      post: {
        summary: "Créer un ticket support",
        description: "Crée un nouveau ticket support via API. Supporte JSON et multipart/form-data (pour les pièces jointes). Authentification par clé API (header X-API-Key).",
        tags: ["Tickets Support"],
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TicketCreate" },
            },
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["titre"],
                properties: {
                  titre: { type: "string", maxLength: 500 },
                  description: { type: "string" },
                  tags: { type: "string", description: 'JSON array de tags, ex: ["bug","urgent"]' },
                  type_probleme: { type: "string", enum: ["bug", "fonctionnalite", "question", "amelioration", "autre"] },
                  priorite: { type: "string", enum: ["basse", "moyenne", "haute", "critique"] },
                  contact_nom: { type: "string" },
                  contact_email: { type: "string", format: "email" },
                  etablissement_id: { type: "string", format: "uuid" },
                  attachments: { type: "array", items: { type: "string", format: "binary" }, maxItems: 5, description: "Max 5 fichiers, 10 MB chacun" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Ticket créé",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    ticket: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        numero_ticket: { type: "string" },
                        titre: { type: "string" },
                        priorite: { type: "string" },
                        statut: { type: "string" },
                        created_at: { type: "string", format: "date-time" },
                        attachments_count: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { description: "Rate limit dépassé" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
      },
    },
    schemas: {
      Etablissement: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          nom: { type: "string" },
          statut: { type: "string" },
          email: { type: "string", format: "email" },
          telephone: { type: "string" },
          adresse: { type: "string" },
          ville: { type: "string" },
          code_postal: { type: "string" },
          commercial_id: { type: "string", format: "uuid" },
          csm_id: { type: "string", format: "uuid" },
          ca_mensuel: { type: "number" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      EtablissementCreate: {
        type: "object",
        required: ["nom"],
        properties: {
          nom: { type: "string" },
          email: { type: "string", format: "email" },
          telephone: { type: "string" },
          adresse: { type: "string" },
          ville: { type: "string" },
          code_postal: { type: "string" },
          groupe_id: { type: "string", format: "uuid" },
          partenaire_id: { type: "string", format: "uuid" },
        },
      },
      EtablissementUpdate: {
        type: "object",
        properties: {
          nom: { type: "string" },
          email: { type: "string", format: "email" },
          telephone: { type: "string" },
          adresse: { type: "string" },
          ville: { type: "string" },
          code_postal: { type: "string" },
          statut: { type: "string" },
        },
      },
      Contact: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          prenom: { type: "string" },
          nom: { type: "string" },
          email: { type: "string", format: "email" },
          telephone: { type: "string" },
          fonction: { type: "string" },
          etablissement_id: { type: "string", format: "uuid" },
        },
      },
      ContactCreate: {
        type: "object",
        required: ["prenom", "nom", "email"],
        properties: {
          prenom: { type: "string" },
          nom: { type: "string" },
          email: { type: "string", format: "email" },
          telephone: { type: "string" },
          fonction: { type: "string" },
          etablissement_id: { type: "string", format: "uuid" },
          groupe_id: { type: "string", format: "uuid" },
          partenaire_id: { type: "string", format: "uuid" },
        },
      },
      Facture: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          numero: { type: "string" },
          etablissement_id: { type: "string", format: "uuid" },
          montant_ht: { type: "number" },
          montant_ttc: { type: "number" },
          statut: { type: "string" },
          date_emission: { type: "string", format: "date" },
          date_echeance: { type: "string", format: "date" },
        },
      },
      TacheCreate: {
        type: "object",
        required: ["titre"],
        properties: {
          titre: { type: "string" },
          description: { type: "string" },
          etablissement_id: { type: "string", format: "uuid" },
          assignee_id: { type: "string", format: "uuid" },
          date_echeance: { type: "string", format: "date" },
          priorite: { type: "string", enum: ["basse", "normale", "haute", "urgente"] },
        },
      },
      TicketCreate: {
        type: "object",
        required: ["titre"],
        properties: {
          titre: { type: "string", maxLength: 500, description: "Titre du ticket" },
          description: { type: "string", description: "Description détaillée" },
          tags: { type: "array", items: { type: "string" }, description: "Tags pour catégoriser" },
          type_probleme: { type: "string", enum: ["bug", "fonctionnalite", "question", "amelioration", "autre"] },
          priorite: { type: "string", enum: ["basse", "moyenne", "haute", "critique"], default: "moyenne" },
          contact_nom: { type: "string" },
          contact_email: { type: "string", format: "email" },
          etablissement_id: { type: "string", format: "uuid" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Non autorisé",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      BadRequest: {
        description: "Requête invalide",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                details: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
      NotFound: {
        description: "Ressource non trouvée",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

const swaggerHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenPulse API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        spec: ${JSON.stringify(openApiSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout"
      });
    }
  </script>
</body>
</html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = checkRateLimit(`api-v1-docs:${extractClientIp(req)}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return rateLimitedResponse(rl, corsHeaders);


  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format");

    if (format === "json") {
      return new Response(JSON.stringify(openApiSpec, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (format === "yaml") {
      const yamlContent = `# OpenPulse API Specification
# Download JSON: ?format=json
openapi: "3.0.3"
info:
  title: "OpenPulse API"
  version: "1.0.0"
# Full spec available at ?format=json`;
      return new Response(yamlContent, {
        headers: { ...corsHeaders, "Content-Type": "text/yaml" },
      });
    }

    return new Response(swaggerHtml, {
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (error: unknown) {
    return buildErrorResponse('api-v1-docs', error, corsHeaders, 500);
  }
});

