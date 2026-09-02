# CONF-04 — Base légale du tracking email

> **Statut** : 🟡 Analyse technique à valider DPO.

## 1. Dispositif technique

Deux mécanismes sont actifs sur les emails sortants envoyés via l'application
OpenPulse :

| Mécanisme | Edge function | Donnée collectée | Persistance |
|---|---|---|---|
| Pixel d'ouverture (1×1) | `track-email-open` | `email_message_id`, `opened_at`, IP, user-agent | `email_message_events` (13 mois) |
| Réécriture de liens | `track-email-click` | `email_message_id`, `link_url`, `clicked_at`, IP, user-agent | `email_message_events` (13 mois) |

Le scoring comportemental dérivé (`email_opened`, `email_clicked`) alimente le
module **Prospect scoring** (cf. mémoire *Behavioral Scoring & Attribution*).

## 2. Analyse RGPD

### 2.1 Contexte d'usage

OpenPulse est un outil **interne B2B**. Les destinataires sont :

1. Des **collaborateurs internes** (autres salariés OpenPulse) — usage opérationnel.
2. Des **contacts professionnels d'établissements de santé partenaires** —
   prospection / suivi commercial B2B.
3. Aucun envoi B2C massif.

### 2.2 Base légale retenue

**Intérêt légitime** (RGPD Art. 6.1.f) : mesurer l'engagement commercial pour
adapter le suivi des prospects B2B et améliorer la qualité du service.

**Test de balance (LIA — Legitimate Interest Assessment)** :

| Critère | Évaluation |
|---|---|
| Finalité légitime | ✅ Pilotage commercial B2B, optimisation des relances |
| Nécessité | ✅ Pas d'alternative moins intrusive pour mesurer l'engagement |
| Mise en balance | ✅ Données B2B, faible attente de confidentialité sur l'ouverture d'un email pro |
| Garanties | ✅ Pas de cookies tiers, IP tronquée, conservation 13 mois, droit d'opposition documenté |

**Conclusion provisoire** : base légale **intérêt légitime** acceptable pour les
contacts B2B. À reconfirmer si le périmètre s'élargit à des destinataires B2C.

### 2.3 Droits des personnes

- **Information** : la politique de confidentialité (`docs/PRIVACY_POLICY.md`
  §5) mentionne explicitement le tracking et le droit d'opposition.
- **Opposition** : un destinataire peut demander la désactivation via
  `dpo@exploitant.example.org`. À implémenter techniquement : flag
  `contacts.tracking_opt_out = true` qui désactive le pixel et la réécriture
  pour ce contact.
- **Effacement** : les événements de tracking sont anonymisés par
  `rgpd-anonymize` lors d'une demande d'effacement (FK `contact_id` → hash).

### 2.4 Action TODO produit

- [ ] Ajouter une colonne `contacts.tracking_opt_out boolean default false`.
- [ ] Conditionner `track-email-open` et `track-email-click` à
      `tracking_opt_out = false`.
- [ ] Ajouter un lien « Se désinscrire du tracking » en pied des emails sortants
      pointant sur une route publique `/email-tracking-optout/:token`.
- [ ] Documenter la LIA validée dans le registre RGPD Art. 30.

## 3. Décision attendue

| Option | Conséquence |
|---|---|
| **A** — Conserver intérêt légitime (recommandé) | Implémenter le flag opt-out + lien de désinscription |
| **B** — Basculer sur consentement explicite | Ajouter un opt-in par contact ; impact négatif sur le scoring |
| **C** — Désactiver le tracking | Supprimer pixels + réécriture ; perte du scoring comportemental |

**Recommandation la plateforme initiale agent** : **Option A** (alignée avec l'usage B2B et
les pratiques CRM du marché), sous réserve de validation DPO.

---

*Document technique CONF-04. Référence audit 2026-05-30.*
