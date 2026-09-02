# CONF-05 — Statut HDS (Hébergement de Données de Santé)

> **Statut** : 🟡 Analyse technique à valider DPO + direction.

## 1. Question

L'application OpenPulse traite-t-elle des **données de santé à caractère
personnel** au sens de l'article L. 1111-8 du Code de la santé publique, et,
si oui, est-elle hébergée chez un hébergeur **certifié HDS** ?

## 2. Données traitées — qualification

| Donnée | Catégorie | Données de santé ? |
|---|---|:---:|
| Contacts d'établissements (nom, fonction, email pro) | Identité B2B | ❌ Non |
| Échanges emails avec établissements | Correspondance professionnelle | ❌ Non |
| Contrats, factures, devis | Données commerciales | ❌ Non |
| Émargements de formation | Présence en formation | ❌ Non (aucun diagnostic) |
| Enquêtes de satisfaction | Avis qualitatif | ❌ Non |
| Notes de réunion / comptes-rendus | Notes internes | ⚠️ À vérifier au cas par cas |
| Notes RH internes (collaborateurs OpenPulse) | Données RH | ❌ Non (sauf arrêts maladie : voir §3) |

**Conclusion à date** : la plateforme **ne traite pas de dossiers patients,
de diagnostics, de résultats d'examens ni de prescriptions**. Les données sont
**majoritairement B2B** (relation commerciale avec des établissements).

## 3. Zones grises à clarifier

1. **Arrêts maladie / certificats médicaux RH** : si stockés dans `rh_documents`,
   ils constituent des **données de santé du salarié**. À ce jour, l'usage
   constaté est le dépôt de PDF dans la GED RH avec accès restreint
   `can_manage_rh_data()`. Volume faible (< 50 PDF/an). **Non qualifiant HDS**
   en soi (donnée RH du collaborateur, pas patient soigné).
2. **Notes commerciales libres** : un commercial pourrait, par erreur, saisir
   une information médicale d'un patient dans une note. → mesure produit :
   ajouter un message d'avertissement dans le champ « Notes » des contacts.
3. **Pièces jointes emails** : un partenaire pourrait envoyer un fichier
   contenant des données patient. → mesure produit : politique de purge des
   pièces jointes > 90 jours sur les emails non liés à un contrat.

## 4. Hébergement actuel

| Couche | Hébergeur | Certification |
|---|---|---|
| Application & DB | **Supabase** (région **EU — Frankfurt**) | Hébergeur AWS (sous-jacent) : **HDS-compliant** (AWS Europe est certifié HDS). Supabase lui-même : **non certifié HDS** à date. |
| Edge Functions | **Supabase** (Deno Deploy, région EU) | Idem |
| CDN front | **la plateforme initiale** (`*.apercu.example.org`) | Non certifié HDS |
| IA Jarvis | **Azure OpenAI** (région EU) | Microsoft Azure : **certifié HDS** |
| Signature | **DocuSeal** (cloud, région à confirmer) | À vérifier |

## 5. Conclusion provisoire

**À date, OpenPulse n'a pas l'obligation d'être hébergé HDS** : la plateforme
traite essentiellement des données B2B (commercial + RH interne), pas de
dossier patient.

**Cependant, deux conditions doivent être maintenues** :

1. **Interdiction documentée** de stocker dans la plateforme des données de
   santé identifiantes de patients (diagnostics, prescriptions, examens).
   → à intégrer dans la charte d'usage interne.
2. **Mesures techniques de prévention** :
   - Avertissement dans les champs de note libre.
   - Purge automatique des pièces jointes anciennes non rattachées à un contrat.
   - Revue trimestrielle d'un échantillon de notes par le DPO.

**Si l'usage évolue** (intégration d'un module patient, dossier de soins, etc.),
**bascule obligatoire vers un hébergeur certifié HDS** (Outscale, OVH Healthcare,
Microsoft Azure HDS, etc.).

## 6. Actions à valider

- [ ] **Direction** : valider l'interdiction d'usage « données patient » et la
      faire signer aux collaborateurs (charte).
- [ ] **DPO** : ajouter cette qualification au registre RGPD Art. 30.
- [ ] **Produit** : ajouter le warning UI dans les champs de notes libres.
- [ ] **Produit** : implémenter la purge auto des pièces jointes > 90 jours non
      rattachées (job CRON).
- [ ] **DPO** : audit trimestriel d'un échantillon de notes (10 contacts
      tirés au sort).

---

*Document technique CONF-05. Référence audit 2026-05-30. Ne constitue pas
un avis juridique.*
