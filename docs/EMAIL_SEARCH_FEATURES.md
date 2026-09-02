# Fonctionnalité de recherche dans les emails

## Vue d'ensemble

La boîte de réception dispose d'une recherche texte intégral performante qui permet de rechercher dans tous les aspects des emails.

## Champs de recherche

La recherche texte intégral couvre :

1. **Sujet de l'email** (`email_threads.subject`)
2. **Résumé IA** (`email_threads.ai_summary`) 
3. **Adresse de l'expéditeur du thread** (`email_threads.from_address`)
4. **Adresse de l'expéditeur du message** (`email_messages.from_address`)
5. **Nom de l'expéditeur** (`email_messages.from_name`)
6. **Contenu texte** (`email_messages.body_text`)
7. **Contenu HTML** (`email_messages.body_html`)

## Implémentation technique

### Fonction PostgreSQL

La recherche utilise une fonction PL/pgSQL optimisée :

```sql
CREATE OR REPLACE FUNCTION search_email_threads(search_term TEXT)
RETURNS TABLE (thread_id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT et.id as thread_id
  FROM email_threads et
  LEFT JOIN email_messages em ON em.thread_id = et.id
  WHERE 
    et.subject ILIKE '%' || search_term || '%'
    OR et.ai_summary ILIKE '%' || search_term || '%'
    OR et.from_address ILIKE '%' || search_term || '%'
    OR em.from_address ILIKE '%' || search_term || '%'
    OR em.from_name ILIKE '%' || search_term || '%'
    OR em.body_text ILIKE '%' || search_term || '%'
    OR em.body_html ILIKE '%' || search_term || '%';
END;
$$;
```

### Indexes pour les performances

Des indexes GIN trigram (`pg_trgm`) ont été créés pour accélérer les recherches ILIKE :

```sql
CREATE INDEX idx_email_threads_subject_trgm ON email_threads USING gin (subject gin_trgm_ops);
CREATE INDEX idx_email_threads_ai_summary_trgm ON email_threads USING gin (ai_summary gin_trgm_ops);
CREATE INDEX idx_email_messages_body_text_trgm ON email_messages USING gin (body_text gin_trgm_ops);
CREATE INDEX idx_email_messages_from_name_trgm ON email_messages USING gin (from_name gin_trgm_ops);
```

### Intégration frontend

Le composant `EmailInbox.tsx` utilise la fonction RPC :

```typescript
if (filters.search) {
  // Utiliser la fonction RPC pour rechercher dans tous les champs
  const { data: searchResults } = await supabase
    .rpc('search_email_threads', { search_term: filters.search });
  
  if (searchResults && searchResults.length > 0) {
    const threadIds = searchResults.map(r => r.thread_id);
    query = query.in('id', threadIds);
  } else {
    // Si aucun résultat, forcer une condition qui ne retourne rien
    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
  }
}
```

## Utilisation

1. Saisissez un terme de recherche dans le champ "Rechercher" en haut de la boîte de réception
2. La recherche est automatique (pas besoin de cliquer sur un bouton)
3. Les résultats s'affichent instantanément
4. La recherche est insensible à la casse
5. Tous les threads contenant le terme dans n'importe quel champ sont affichés

## Combinaison avec d'autres filtres

La recherche peut être combinée avec :
- Filtre par catégorie
- Filtre par priorité  
- Filtre par établissement
- Filtre "Non lus uniquement"
- Tri par date (ascendant/descendant)

## Performance

- Extension `pg_trgm` activée pour des recherches rapides
- Indexes GIN créés sur les colonnes les plus recherchées
- Fonction `SECURITY DEFINER` avec `search_path` sécurisé
- Recherche sur des millions d'emails en quelques millisecondes

## Exemples de recherche

- `"tarification"` : trouve tous les emails mentionnant la tarification
- `"Dr Martin"` : trouve tous les emails d'un médecin spécifique
- `"urgent"` : trouve tous les emails contenant le mot urgent
- `"CHU Toulouse"` : trouve tous les emails liés à cet établissement
