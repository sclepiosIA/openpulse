#!/usr/bin/env python3
"""
Génère les tables que le corpus de migrations ne crée jamais.

POURQUOI
Une partie des tables de production a été créée directement dans l'interface de
la plateforme hébergée, sans migration. Elles n'existent donc dans aucun fichier
SQL du dépôt : le rejeu du corpus, même parfait, ne les produira jamais. Vérifié
sur huit d'entre elles — kb_articles, candidates, feature_flags, job_offers,
cron_health, admin_impersonations, app_feedback, document_embeddings — dont
aucune ne porte de CREATE TABLE dans les 942 migrations, alors que six sont
référencées par d'autres migrations.

La seule source disponible est `src/integrations/supabase/types.ts`, un
instantané généré du schéma de production, versionné dans le dépôt. Aucun accès
à une base réelle n'est nécessaire.

CE QUI EST DÉDUIT, ET CE QUI NE L'EST PAS
Un type TypeScript porte le nom et le type de chaque colonne, et sa nullabilité.
Il ne porte NI clé primaire, NI clé étrangère, NI contrainte d'unicité, NI
valeur par défaut, NI index. Ce script :
  - déduit les colonnes et leur nullabilité ;
  - pose une clé primaire sur `id` quand la colonne existe ;
  - active la sécurité au niveau ligne sur chaque table créée, sans policy —
    donc fermée par défaut. Une table ouverte par erreur est un incident ; une
    table fermée est un ticket.
Le reste doit être complété à la main, table par table, selon l'usage.

Usage : generer-tables-absentes.py <types.ts> <schema.sql> <sortie.sql>
"""
import re
import sys

TYPES, SCHEMA, SORTIE = sys.argv[1], sys.argv[2], sys.argv[3]


def type_postgres(nom: str, brut: str) -> tuple[str, bool]:
    brut = brut.strip().rstrip(',')
    nullable = 'null' in brut
    base = brut.replace('| null', '').strip()

    if base == 'number':
        pg = 'integer' if re.search(r'(_count|_nb|nombre|ordre|position|priorite|annee|mois|jour|niveau|score)$', nom) else 'numeric'
    elif base == 'boolean':
        pg = 'boolean'
    elif base == 'string[]':
        pg = 'text[]'
    elif base.startswith('Json') or base.startswith('{') or base.startswith('Database['):
        pg = 'jsonb'
    elif base == 'string':
        if nom == 'id' or nom.endswith('_id'):
            pg = 'uuid'
        elif re.search(r'(_at|_date|^date_|_le)$', nom):
            pg = 'timestamptz'
        else:
            pg = 'text'
    elif base.endswith('[]'):
        pg = 'jsonb'
    else:
        # enum inline ou type nomme : on garde du texte, quitte a resserrer plus tard
        pg = 'text'
    return pg, nullable


def tables_de_types(chemin: str) -> dict[str, dict[str, str]]:
    s = open(chemin, encoding='utf-8').read()
    debut, fin = s.find('Tables: {'), s.find('Views: {')
    zone = s[debut:fin if fin > debut else len(s)]
    tables = {}
    for m in re.finditer(r'^      (\w+): \{$', zone, re.M):
        nom = m.group(1)
        bloc = zone[m.end():]
        j = bloc.find('Row: {')
        if j < 0:
            continue
        k = bloc.find('\n        }', j)
        champs = re.findall(r'^\s{10,}(\w+)\??:\s*(.+?)$', bloc[j:k], re.M)
        if champs:
            tables[nom] = dict(champs)
    return tables


def tables_du_schema(chemin: str) -> set[str]:
    s = open(chemin, encoding='utf-8').read()
    return set(re.findall(r'CREATE TABLE (?:public\.)?(\w+)', s))


# Tables retirées de la distribution avec le module « Base de connaissances ».
#
# POURQUOI CETTE LISTE EXISTE
# Ce script déduit les tables à créer de `src/integrations/supabase/types.ts`,
# qui est un instantané du schéma de PRODUCTION et survit à l'extraction — il
# déclare donc encore les tables du module retiré. Sans cette liste, chaque
# régénération de schema-03 les recréerait, et le retrait ne tiendrait pas d'une
# fois sur l'autre. C'est un piège discret : le fichier produit serait juste au
# moment où on le regarde, et faux dès la génération suivante.
#
# Retirer une entrée d'ici ne suffit pas à réintroduire une table : il faudrait
# aussi que le module qui s'en sert revienne.
TABLES_RETIREES = {
    'kb_article_suggestions',
    'kb_article_versions',
    'kb_articles',
    'kb_attachments',
    'kb_categories',
    'kb_faqs',
    'kb_feedbacks',
    'kb_search_logs',
    # Chiffres de résultats commerciaux affichés par la base de connaissances.
    # Son unique consommateur, src/hooks/knowledge/useKBMetrics.ts, part avec le
    # module.
    'kb_result_metrics',
}


def main() -> int:
    attendues = tables_de_types(TYPES)
    presentes = tables_du_schema(SCHEMA)
    absentes = {
        t: c for t, c in attendues.items()
        if t not in presentes and t not in TABLES_RETIREES
    }

    retirees_vues = sorted(TABLES_RETIREES & set(attendues))

    print(f"tables en production      : {len(attendues)}")
    print(f"tables du schema          : {len(presentes)}")
    print(f"tables a generer          : {len(absentes)}")
    print(f"tables retirees ignorees  : {len(retirees_vues)}")

    with open(SORTIE, 'w', encoding='utf-8') as f:
        f.write("""-- =====================================================================
-- Tables absentes du corpus de migrations.
--
-- Elles ont ete creees hors migration sur la plateforme hebergee : aucun
-- fichier SQL du depot ne les porte, et le rejeu du corpus ne les produira
-- jamais. Elles sont reconstituees ici depuis l'instantane de production
-- versionne dans le depot.
--
-- Genere par tools/openrelease/schema/generer-tables-absentes.py.
--
-- LIMITES ASSUMEES, a completer table par table selon l'usage :
--   - aucune cle etrangere : un type TypeScript n'en porte pas ;
--   - aucune contrainte d'unicite autre que la cle primaire ;
--   - aucune valeur par defaut, aucun index ;
--   - securite au niveau ligne ACTIVEE et AUCUNE policy : la table est donc
--     fermee. C'est deliberé — une table ouverte par erreur est un incident,
--     une table fermee est un ticket.
-- =====================================================================

""")
        for table, champs in sorted(absentes.items()):
            f.write(f"-- {table} ({len(champs)} colonnes)\n")
            f.write(f"CREATE TABLE IF NOT EXISTS public.{table} (\n")
            lignes = []
            for nom, brut in champs.items():
                pg, nullable = type_postgres(nom, brut)
                contrainte = '' if nullable else ' NOT NULL'
                if nom == 'id':
                    contrainte = ' PRIMARY KEY'
                lignes.append(f'  "{nom}" {pg}{contrainte}')
            f.write(',\n'.join(lignes))
            f.write("\n);\n")
            f.write(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;\n\n")

    print(f"ecrit : {SORTIE}")
    sans_id = [t for t, c in absentes.items() if 'id' not in c]
    if sans_id:
        print(f"\nsans colonne id, donc sans cle primaire ({len(sans_id)}) :")
        for t in sorted(sans_id)[:12]:
            print(f"    {t}")
    return 0


sys.exit(main())
