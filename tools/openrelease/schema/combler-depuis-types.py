#!/usr/bin/env python3
"""
Comble les colonnes que le corpus de migrations ne crée pas.

POURQUOI CE SCRIPT EXISTE
Le corpus est incomplet : certaines colonnes ont été ajoutées directement en
production, hors migration. Elles n'existent donc dans aucun fichier SQL, mais
des fonctions du schéma les utilisent — et l'échec ne se voit qu'à l'usage. Le
cas qui l'a révélé : `profiles.is_sandbox`, absente du corpus, utilisée par un
déclencheur, ce qui faisait échouer toute création de compte.

La source de vérité pour combler est `src/integrations/supabase/types.ts`, un
instantané généré du schéma de production. Aucun accès à une base réelle n'est
nécessaire.

CE QUE CE SCRIPT NE FAIT PAS
Il ne devine ni les contraintes, ni les valeurs par défaut, ni les clés
étrangères, ni les index : un type TypeScript ne les porte pas. Il produit des
colonnes nullables, ce qui est le choix sûr — une colonne en trop est inerte,
une colonne manquante casse une fonction.

Usage : combler-depuis-types.py <types.ts> <schema.sql> [--ecrire]
"""
import re
import sys

TYPES = sys.argv[1]
SCHEMA = sys.argv[2]
ECRIRE = '--ecrire' in sys.argv

# --- types TypeScript -> types Postgres -------------------------------------
# Un `string` peut être du texte, une date ou un identifiant : le nom de la
# colonne est le seul indice disponible, et on préfère text par défaut, qui
# accepte tout, à un type plus précis qui rejetterait des valeurs valides.
def type_postgres(nom: str, t: str) -> str:
    t = t.strip().rstrip(',')
    optionnel = 'null' in t
    base = t.replace('| null', '').strip()

    if base == 'number':
        pg = 'integer' if re.search(r'(_count|_nb|nombre|ordre|position|priorite|annee|mois|jour)$', nom) else 'numeric'
    elif base == 'boolean':
        pg = 'boolean'
    elif base.startswith('Json') or base.startswith('{') or base.endswith('[]') and 'string[]' not in base:
        pg = 'jsonb'
    elif base == 'string[]':
        pg = 'text[]'
    elif base == 'string':
        if re.search(r'(_id|^id)$', nom):
            pg = 'uuid'
        elif re.search(r'(_at|_date|date_|_le)$', nom):
            pg = 'timestamptz'
        else:
            pg = 'text'
    else:
        pg = 'text'
    return pg, optionnel


def colonnes_de_types(chemin: str) -> dict[str, dict[str, str]]:
    s = open(chemin, encoding='utf-8').read()
    debut = s.find('Tables: {')
    fin = s.find('Views: {')
    if debut < 0:
        return {}
    zone = s[debut:fin if fin > debut else len(s)]

    tables: dict[str, dict[str, str]] = {}
    for m in re.finditer(r'^      (\w+): \{$', zone, re.M):
        nom = m.group(1)
        bloc = zone[m.end():]
        j = bloc.find('Row: {')
        if j < 0:
            continue
        k = bloc.find('\n        }', j)
        champs = re.findall(r'^\s{10,}(\w+)\??:\s*(.+?)$', bloc[j:k], re.M)
        if champs:
            tables[nom] = {n: t for n, t in champs}
    return tables


def colonnes_du_schema(chemin: str) -> dict[str, set[str]]:
    s = open(chemin, encoding='utf-8').read()
    tables: dict[str, set[str]] = {}
    for m in re.finditer(r'CREATE TABLE (?:public\.)?(\w+) \((.*?)^\);', s, re.S | re.M):
        nom, corps = m.group(1), m.group(2)
        cols = set()
        for ligne in corps.split('\n'):
            l = ligne.strip()
            mm = re.match(r'^"?(\w+)"?\s+\S', l)
            if mm and mm.group(1).upper() not in ('CONSTRAINT', 'PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK'):
                cols.add(mm.group(1))
        tables[nom] = cols
    # Les colonnes ajoutees plus loin par ALTER comptent aussi.
    for m in re.finditer(r'ALTER TABLE (?:ONLY )?(?:public\.)?(\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?"?(\w+)"?', s):
        tables.setdefault(m.group(1), set()).add(m.group(2))
    return tables


def main() -> int:
    attendues = colonnes_de_types(TYPES)
    presentes = colonnes_du_schema(SCHEMA)

    print(f"instantané de production : {len(attendues)} tables")
    print(f"schéma consolidé         : {len(presentes)} tables")

    manquantes: list[tuple[str, str, str, bool]] = []
    tables_absentes = []
    for table, champs in sorted(attendues.items()):
        if table not in presentes:
            tables_absentes.append(table)
            continue
        for nom, t in champs.items():
            if nom not in presentes[table]:
                pg, opt = type_postgres(nom, t)
                manquantes.append((table, nom, pg, opt))

    print(f"\ntables absentes du schéma      : {len(tables_absentes)}")
    print(f"colonnes manquantes            : {len(manquantes)} sur {len(set(t for t, *_ in manquantes))} tables")

    if tables_absentes:
        print("\n  tables présentes en production et absentes du schéma :")
        for t in tables_absentes[:20]:
            print(f"      {t}")
        if len(tables_absentes) > 20:
            print(f"      … et {len(tables_absentes) - 20} autres")

    par_table: dict[str, list] = {}
    for table, nom, pg, opt in manquantes:
        par_table.setdefault(table, []).append((nom, pg))
    print("\n  colonnes manquantes, par table :")
    for table, cols in sorted(par_table.items(), key=lambda x: -len(x[1]))[:15]:
        print(f"      {table:38} {len(cols):>3} : {', '.join(n for n, _ in cols[:5])}{'…' if len(cols) > 5 else ''}")

    if not ECRIRE:
        print("\n(passer --ecrire pour produire le fichier de complément)")
        return 0

    sortie = SCHEMA.replace('.sql', '') + '-complements.sql'
    with open(sortie, 'w', encoding='utf-8') as f:
        f.write("""-- =====================================================================
-- Compléments de schéma déduits de l'instantané de production.
--
-- Le corpus de migrations ne crée pas ces colonnes : elles ont été ajoutées
-- directement en production, hors migration. Leur absence ne se voit qu'à
-- l'usage, quand une fonction les référence — c'est ce qui faisait échouer
-- toute création de compte.
--
-- Généré par tools/openrelease/schema/combler-depuis-types.py.
-- Toutes les colonnes sont nullables : le type TypeScript ne porte ni
-- contrainte, ni valeur par défaut, ni clé étrangère. Une colonne en trop est
-- inerte, une colonne manquante casse une fonction.
-- =====================================================================

""")
        for table, cols in sorted(par_table.items()):
            f.write(f"-- {table}\n")
            for nom, pg in sorted(cols):
                f.write(f'ALTER TABLE public.{table} ADD COLUMN IF NOT EXISTS "{nom}" {pg};\n')
            f.write('\n')
    print(f"\nécrit : {sortie}")
    return 0


sys.exit(main())
