# OpenPulse Platform — Catalogue d'événements

Bus central : table `platform_events` (Gestion). Dispatcher CRON 1 min, retry exponentiel 5×, DLQ après échec.

## Signature webhook

Tous les webhooks sortants sont signés :

```
X-Marque-Signature: t=<unix_ts>,v1=<hex_hmac_sha256>
X-Marque-Event: <event_type>
X-Marque-Event-Id: <uuid>
Content-Type: application/json
```

Calcul HMAC : `HMAC_SHA256(hmac_secret, "<unix_ts>.<raw_body>")`. Rejeter si `|now - t| > 300s`.

## Enveloppe commune

```json
{
  "event_id": "uuid",
  "event_type": "client.created",
  "occurred_at": "2026-06-12T10:00:00Z",
  "etablissement_id": "uuid",
  "data": { ... }
}
```

## Événements

### `client.created`
Émis par Gestion quand `etablissements.statut` passe à `production`.

```json
{
  "data": {
    "nom": "CH Exemple",
    "siret": "12345678900012",
    "ville": "Lyon",
    "plan": "standard",
    "modules_actifs": ["mco", "urgences"],
    "contact_admin": {
      "email": "admin@ch-exemple.example.org",
      "nom": "Dupont",
      "prenom": "Jean"
    }
  }
}
```

Consommateurs : Site Web (crée `client_portal_user`, envoie magic link), Produit (crée tenant + admin).

### `client.updated`
Changement plan/modules/contacts/identité. Mêmes champs que `created`, complets (pas de diff).

### `client.suspended`
```json
{ "data": { "raison": "impaye", "depuis": "2026-06-01" } }
```

### `client.deleted`
RGPD — consommateurs doivent anonymiser sous 30 j.

### `entitlement.changed`
```json
{
  "data": {
    "plan": "premium",
    "modules": [
      { "code": "mco", "enabled": true, "quota": null },
      { "code": "smr", "enabled": true, "quota": 500 }
    ]
  }
}
```

### `user.invited`
```json
{
  "data": {
    "email": "user@ch-exemple.example.org",
    "nom": "Martin",
    "role": "admin",
    "invited_by": "gestion"
  }
}
```

### `usage.event` (Produit → Gestion)
Pas un webhook : POST direct sur `/platform-usage-events` (batch).

### `support.ticket.created`
```json
{
  "data": {
    "ticket_id": "uuid",
    "sujet": "Bug module urgences",
    "user_email": "user@ch-exemple.example.org",
    "priorite": "haute"
  }
}
```

### `billing.invoice.paid`
```json
{
  "data": {
    "facture_id": "uuid",
    "numero": "FAC-2026-001",
    "montant_ttc": 1200.00,
    "paid_at": "2026-06-12T09:30:00Z"
  }
}
```

## Idempotence côté consommateur

Stocker `event_id` reçus pendant 7 j minimum ; rejouer = no-op.

## Retry & DLQ

Gestion retry : 30s, 2min, 10min, 1h, 6h. Après 5 échecs → `status='dead'`, alerte Pulse #alertes-systeme.
