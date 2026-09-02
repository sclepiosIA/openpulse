# Guide Technique - Module RGPD & Conformité

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Composants](#composants)
- [Tables de Base de Données](#tables-de-base-de-données)
- [Edge Functions](#edge-functions)
- [Fonctionnalités Clés](#fonctionnalités-clés)
- [Audit Trail](#audit-trail)

---

## Vue d'ensemble

Le module RGPD assure la conformité réglementaire :

| Fonctionnalité | Description |
|----------------|-------------|
| **Registre des traitements** | Documentation des activités de traitement |
| **Gestion des consentements** | Collecte et historique des consentements |
| **Demandes d'exercice** | Accès, rectification, effacement, portabilité |
| **Export données** | Génération de rapports personnels |
| **Audit trail** | Traçabilité des actions |
| **Alertes** | Notifications d'échéances et violations |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MODULE RGPD                             │
├─────────────────────────────────────────────────────────────┤
│  Routes: /parametres/rgpd                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Registre   │  │ Consentements│  │  Demandes   │         │
│  │ Traitements │  │    (Opt-in)  │  │  Exercice   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                  │
│         ▼                ▼                ▼                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Export Données                      │   │
│  │  • Export JSON/PDF personnel                          │   │
│  │  • Anonymisation                                      │   │
│  │  • Effacement sécurisé                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Audit Trail                         │   │
│  │  • Historique complet des modifications              │   │
│  │  • Logs d'accès aux données                          │   │
│  │  • Traçabilité des actions                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Composants

### Composants Principaux (`src/components/rgpd/`)

| Composant | Description |
|-----------|-------------|
| `RGPDDashboard.tsx` | Dashboard conformité |
| `RegistreTraitements.tsx` | Liste des traitements |
| `TraitementForm.tsx` | Création/édition traitement |
| `ConsentementsList.tsx` | Historique consentements |
| `ConsentementBanner.tsx` | Bannière cookies/consentement |
| `DemandesExercice.tsx` | Liste demandes utilisateurs |
| `DemandeDetail.tsx` | Traitement d'une demande |
| `ExportDonnees.tsx` | Interface d'export |
| `AuditLogViewer.tsx` | Visualisation audit trail |
| `AlertesRGPD.tsx` | Alertes conformité |

---

## Tables de Base de Données

### `rgpd_traitements`

```sql
CREATE TABLE rgpd_traitements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  nom TEXT NOT NULL,
  description TEXT,
  
  -- Finalités
  finalites TEXT[] NOT NULL,
  base_legale TEXT NOT NULL, -- consentement, contrat, obligation_legale, interet_legitime, mission_publique, interets_vitaux
  
  -- Données concernées
  categories_donnees TEXT[] NOT NULL, -- identite, contact, professionnelles, financieres, sante
  categories_personnes TEXT[] NOT NULL, -- employes, clients, prospects, patients
  
  -- Destinataires
  destinataires TEXT[],
  transferts_hors_ue BOOLEAN DEFAULT false,
  pays_transferts TEXT[],
  garanties_transfert TEXT,
  
  -- Conservation
  duree_conservation TEXT,
  justification_duree TEXT,
  
  -- Sécurité
  mesures_securite TEXT[],
  
  -- Responsable
  responsable_id UUID REFERENCES profiles,
  
  -- Statut
  statut TEXT DEFAULT 'actif', -- actif, archive
  date_mise_en_oeuvre DATE,
  date_derniere_revision DATE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `rgpd_consentements`

```sql
CREATE TABLE rgpd_consentements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  user_id UUID REFERENCES auth.users,
  email TEXT, -- Si pas de user_id
  
  -- Type
  type TEXT NOT NULL, -- marketing, analytics, cookies, newsletter, partage_partenaires
  
  -- Consentement
  consenti BOOLEAN NOT NULL,
  
  -- Contexte
  source TEXT, -- web, email, app
  ip_address INET,
  user_agent TEXT,
  
  -- Historique
  version_politique TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `rgpd_demandes_droits`

```sql
CREATE TABLE rgpd_demandes_droits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Demandeur
  demandeur_email TEXT NOT NULL,
  demandeur_nom TEXT,
  user_id UUID REFERENCES auth.users,
  
  -- Type de demande (articles RGPD)
  type TEXT NOT NULL, -- acces (15), rectification (16), effacement (17), limitation (18), portabilite (20), opposition (21)
  
  -- Détails
  description TEXT,
  donnees_concernees TEXT[],
  
  -- Vérification identité
  identite_verifiee BOOLEAN DEFAULT false,
  methode_verification TEXT,
  date_verification TIMESTAMPTZ,
  
  -- Traitement
  statut TEXT DEFAULT 'nouvelle', -- nouvelle, en_cours, completee, refusee
  assignee_id UUID REFERENCES profiles,
  
  -- Réponse
  reponse TEXT,
  motif_refus TEXT,
  
  -- Délais
  date_demande TIMESTAMPTZ DEFAULT now(),
  date_limite TIMESTAMPTZ, -- 1 mois par défaut
  date_reponse TIMESTAMPTZ,
  
  -- Export généré
  export_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `rgpd_audit_logs`

```sql
CREATE TABLE rgpd_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Action
  action TEXT NOT NULL, -- create, read, update, delete, export, login, logout
  
  -- Ressource
  table_name TEXT,
  record_id UUID,
  
  -- Acteur
  user_id UUID REFERENCES auth.users,
  ip_address INET,
  user_agent TEXT,
  
  -- Détails
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_audit_log_user ON rgpd_audit_logs(user_id);
CREATE INDEX idx_audit_log_table ON rgpd_audit_logs(table_name);
CREATE INDEX idx_audit_log_date ON rgpd_audit_logs(created_at);
```

### `rgpd_violations`

```sql
CREATE TABLE rgpd_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Description
  titre TEXT NOT NULL,
  description TEXT,
  
  -- Classification
  gravite TEXT NOT NULL, -- faible, moyenne, elevee, critique
  nature TEXT, -- confidentialite, integrite, disponibilite
  
  -- Impact
  donnees_concernees TEXT[],
  personnes_affectees INTEGER,
  
  -- Dates
  date_detection TIMESTAMPTZ DEFAULT now(),
  date_incident TIMESTAMPTZ,
  
  -- Actions
  mesures_prises TEXT,
  notification_cnil BOOLEAN DEFAULT false,
  date_notification_cnil TIMESTAMPTZ,
  notification_personnes BOOLEAN DEFAULT false,
  date_notification_personnes TIMESTAMPTZ,
  
  -- Suivi
  statut TEXT DEFAULT 'ouverte', -- ouverte, en_cours, cloturee
  responsable_id UUID REFERENCES profiles,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Edge Functions

### `rgpd-export-data`

Export des données personnelles d'un utilisateur.

```typescript
POST /functions/v1/rgpd-export-data
{
  "userId": "uuid",
  "format": "json", // json, pdf
  "includeAuditLog": true
}

// Response
{
  "success": true,
  "downloadUrl": "https://storage.../export_rgpd_2026-01-15.json",
  "expiresAt": "2026-01-22T00:00:00Z",
  "dataIncluded": [
    "profile",
    "email_accounts",
    "taches",
    "documents",
    "audit_log"
  ]
}
```

### `rgpd-anonymize` *(livré 2026-05-30)*

Pseudonymisation des PII directes du sujet sur 7 tables (`contacts`, `bookings`,
`live_chat_conversations`, `support_tickets`, `formation_emargements`,
`enquetes_satisfaction`, `email_messages.from_address`). Stratégie =
**pseudonymisation** (token irréversible dérivé d'un SHA-256 salé) + nullification
des champs annexes (téléphone, notes, signature). Les enregistrements et FK sont
conservés pour obligations comptables/légales (10 ans). Journalisée dans
`rgpd_audit_logs`. Accès admin uniquement.

```typescript
POST /functions/v1/rgpd-anonymize
Authorization: Bearer <jwt admin>
{
  "personEmail": "john@example.com",
  "personName": "John Doe",
  "requestId": "uuid-demande-effacement",
  "dryRun": false
}

// Response
{
  "success": true,
  "dryRun": false,
  "report": {
    "subject": { "email": "john@example.com" },
    "pseudonym": "anon_a1b2c3d4e5f6",
    "tables": {
      "contacts":               { "matched": 1, "updated": 1 },
      "bookings":               { "matched": 3, "updated": 3 },
      "live_chat_conversations": { "matched": 0, "updated": 0 },
      "support_tickets":        { "matched": 2, "updated": 2 },
      "formation_emargements":  { "matched": 1, "updated": 1 },
      "enquetes_satisfaction":  { "matched": 0, "updated": 0 },
      "email_messages_from":    { "matched": 12, "updated": 12 }
    },
    "total_records": 19,
    "started_at": "...",
    "completed_at": "..."
  }
}
```

Si `requestId` fourni : la demande `rgpd_demandes_droits` est passée en `completee`
avec `date_traitement` renseignée. UI : bouton **Anonymiser** dans
`RgpdDemandesTab` (visible uniquement pour les demandes de type `effacement`).



### `rgpd-consent-log` *(NON IMPLÉMENTÉ — cible)*

> ⚠️ Non livré. Les consentements sont actuellement écrits directement dans
> `rgpd_consentements` côté application. Cette edge function reste une cible si
> un endpoint public/serveur dédié devient nécessaire.

```typescript
POST /functions/v1/rgpd-consent-log
{
  "email": "user@example.com",
  "type": "marketing",
  "consenti": true,
  "source": "web",
  "versionPolitique": "2026-01-v1"
}
```

---

## Fonctionnalités Clés

### 1. Registre des Traitements

Documentation conforme article 30 RGPD :

```typescript
interface Traitement {
  nom: string;
  finalites: string[];
  baseLegale: 'consentement' | 'contrat' | 'obligation_legale' | 'interet_legitime';
  categoriesDonnees: string[];
  categoriesPersonnes: string[];
  destinataires: string[];
  dureeConservation: string;
  mesuresSecurite: string[];
}
```

### 2. Gestion des Consentements

```tsx
// Bannière de consentement
<ConsentementBanner
  onAcceptAll={() => logConsent(['analytics', 'marketing', 'cookies'], true)}
  onRejectAll={() => logConsent(['analytics', 'marketing', 'cookies'], false)}
  onCustomize={() => setShowPreferences(true)}
/>

// Centre de préférences
<PreferencesPanel
  preferences={[
    { id: 'cookies_essentiels', label: 'Cookies essentiels', required: true },
    { id: 'analytics', label: 'Analytics', required: false },
    { id: 'marketing', label: 'Marketing', required: false },
  ]}
  onSave={handleSavePreferences}
/>
```

### 3. Traitement des Demandes

| Type | Article RGPD | Délai | Actions |
|------|--------------|-------|---------|
| Accès | Art. 15 | 1 mois | Export données |
| Rectification | Art. 16 | 1 mois | Modification |
| Effacement | Art. 17 | 1 mois | Anonymisation |
| Limitation | Art. 18 | 1 mois | Gel traitement |
| Portabilité | Art. 20 | 1 mois | Export JSON |
| Opposition | Art. 21 | 1 mois | Suppression traitement |

### 4. Export des Données

```typescript
// Données exportées par catégorie
const EXPORT_CATEGORIES = {
  profile: ['profiles'],
  contacts: ['contacts'],
  emails: ['email_threads', 'email_messages'],
  taches: ['taches'],
  documents: ['documents'],
  calendar: ['calendar_events'],
  audit: ['rgpd_audit_logs'],
};

// Format JSON structuré
{
  "export_date": "2026-01-15T10:00:00Z",
  "user_email": "user@example.com",
  "data": {
    "profile": { ... },
    "contacts": [ ... ],
    "emails": [ ... ],
    "audit_log": [ ... ]
  }
}
```

---

## Audit Trail

### Trigger Automatique

```sql
-- Fonction de logging
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO rgpd_audit_logs (
    action,
    table_name,
    record_id,
    user_id,
    old_values,
    new_values
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Application aux tables sensibles
CREATE TRIGGER audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_contacts
AFTER INSERT OR UPDATE OR DELETE ON contacts
FOR EACH ROW EXECUTE FUNCTION log_audit_event();
```

### Visualisation

```tsx
function AuditLogViewer({ userId }: { userId?: string }) {
  const { data: logs } = useAuditLog({
    userId,
    startDate: subDays(new Date(), 30),
    actions: ['create', 'update', 'delete', 'export']
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Ressource</TableHead>
          <TableHead>Utilisateur</TableHead>
          <TableHead>Détails</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs?.map(log => (
          <TableRow key={log.id}>
            <TableCell>{format(log.created_at, 'dd/MM/yyyy HH:mm')}</TableCell>
            <TableCell><Badge>{log.action}</Badge></TableCell>
            <TableCell>{log.table_name}</TableCell>
            <TableCell>{log.user?.email}</TableCell>
            <TableCell>
              <AuditDiffViewer old={log.old_values} new={log.new_values} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

## Alertes Conformité

| Alerte | Déclencheur | Action |
|--------|-------------|--------|
| Demande en attente | Délai > 25 jours | Email responsable |
| Consentement expiré | > 2 ans sans renouvellement | Demande reconfirmation |
| Traitement non révisé | > 1 an depuis révision | Notification révision |
| Violation détectée | Création violation | Notification DPO |

---

*Documentation mise à jour en mars 2026 — v1.9.0*
