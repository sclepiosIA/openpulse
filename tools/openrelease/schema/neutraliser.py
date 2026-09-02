#!/usr/bin/env python3
"""
Neutralise le schéma consolidé avant publication.

Le schéma est obtenu par extraction d'une base réelle : il embarque donc ce que
les migrations d'origine y avaient mis, y compris des références à
l'infrastructure de l'éditeur. Ce script les remplace par des lectures de
configuration, de façon idempotente et vérifiable.

Usage : neutraliser.py <schema.sql> [--verifier]
        --verifier : ne modifie rien, sort en code 1 s'il reste quelque chose.
"""
import re
import sys

# --- règles -----------------------------------------------------------------

def fonction_cron_portable(s: str) -> tuple[str, int]:
    """
    Une fonction planifiée embarquait l'URL du projet hébergé et un jeton en
    clair. Sur une instance tierce, elle appellerait l'infrastructure de
    l'éditeur avec ses identifiants. Elle lit désormais les deux depuis le
    coffre, exactement comme elle lisait déjà son secret de planification.
    """
    n = 0

    # 1. le jeton en dur devient une lecture du coffre
    motif_jeton = re.compile(
        r"(\s*)v_anon text := '(?:eyJ[A-Za-z0-9_.-]{20,})';",
        re.M,
    )

    def remplacer_jeton(m):
        nonlocal n
        n += 1
        i = m.group(1)
        return (
            f"{i}v_anon text;"
            f"{i}v_base_url text;"
        )

    s = motif_jeton.sub(remplacer_jeton, s)

    # 2. l'URL en dur devient une concaténation sur la valeur du coffre
    motif_url = re.compile(
        r"url := 'https://[a-z0-9-]+\.supabase\.co/functions/v1/([a-z0-9-]+)'",
    )

    def remplacer_url(m):
        nonlocal n
        n += 1
        return f"url := v_base_url || '/functions/v1/{m.group(1)}'"

    s = motif_url.sub(remplacer_url, s)

    # 3. les deux valeurs sont chargées depuis le coffre, avec un échec explicite
    ancre = (
        "  IF v_secret IS NULL THEN\n"
        "    RAISE EXCEPTION 'CRON_SECRET not found in vault';\n"
        "  END IF;\n"
    )
    ajout = (
        "  IF v_secret IS NULL THEN\n"
        "    RAISE EXCEPTION 'CRON_SECRET absent du coffre';\n"
        "  END IF;\n"
        "\n"
        "  -- L'URL de l'instance et la cle publique sont propres a chaque\n"
        "  -- deploiement : elles vivent dans le coffre, jamais dans le schema.\n"
        "  SELECT decrypted_secret INTO v_base_url\n"
        "  FROM vault.decrypted_secrets WHERE name = 'INSTANCE_BASE_URL' LIMIT 1;\n"
        "  IF v_base_url IS NULL THEN\n"
        "    RAISE EXCEPTION 'INSTANCE_BASE_URL absent du coffre';\n"
        "  END IF;\n"
        "\n"
        "  SELECT decrypted_secret INTO v_anon\n"
        "  FROM vault.decrypted_secrets WHERE name = 'INSTANCE_ANON_KEY' LIMIT 1;\n"
        "  IF v_anon IS NULL THEN\n"
        "    RAISE EXCEPTION 'INSTANCE_ANON_KEY absent du coffre';\n"
        "  END IF;\n"
    )
    if ancre in s:
        s = s.replace(ancre, ajout)
        n += 1

    return s, n


def commentaires_de_marque(s: str) -> tuple[str, int]:
    """Les commentaires de colonnes citaient un domaine de l'editeur en exemple."""
    motif = re.compile(r"https://backend-api\.[a-z-]+\.[a-z]{2,}", re.I)
    s, n = motif.subn("https://backend-api.exemple.fr", s)
    return s, n


def references_projet(s: str) -> tuple[str, int]:
    """Toute reference residuelle au projet heberge de l'editeur."""
    total = 0
    for motif, remplacement in (
        (r"iqhvfmnrypiblqncjnpm", "votre-projet"),
        (r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}", "<CLE_A_CONFIGURER>"),
        (r"\b[Pp]ulsar\b", "OpenPulse"),
        (r"\bScl[eé]pios\b", "OpenPulse"),
        (r"sclepios-ia\.com", "exemple.fr"),
        (r"sclepios\.ai", "exemple.fr"),
        (r"pulsar-ia\.com", "exemple.fr"),
    ):
        s, n = re.subn(motif, remplacement, s)
        total += n
    return s, total


def policies_sans_restriction(s: str) -> tuple[str, int]:
    """
    Une policy « USING (true) » sans clause TO s'applique a TOUS les roles, y
    compris anonyme. Le schema extrait en portait une, qui laissait un visiteur
    non authentifie supprimer les donnees d'autrui.
    """
    motif = re.compile(
        r'CREATE POLICY "Public can delete votes" ON public\.forum_votes FOR DELETE USING \(true\);'
    )
    remplacement = (
        '-- Corrige a la publication : sans clause TO, la policy s\'appliquait a\n'
        '-- tous les roles, anonyme compris.\n'
        'CREATE POLICY "Un utilisateur supprime ses propres votes" ON public.forum_votes '
        'FOR DELETE TO authenticated USING (user_id = auth.uid());'
    )
    return motif.subn(remplacement, s)


REGLES = [
    ("policies sans restriction de role", policies_sans_restriction),
    ("fonction planifiee rendue portable", fonction_cron_portable),
    ("commentaires de marque", commentaires_de_marque),
    ("references au projet heberge", references_projet),
]

MOTIFS_INTERDITS = [
    ("jeton en clair", r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\."),
    ("projet heberge", r"iqhvfmnrypiblqncjnpm"),
    ("marque proscrite", r"(?i)\bpulsar\b(?!\s*\))"),
    ("domaine de l'editeur", r"(?i)sclepios[-.]"),
    ("URL de projet en dur", r"url := 'https://[a-z0-9-]+\.supabase\.co"),
]


def main() -> int:
    chemin = sys.argv[1]
    verifier = "--verifier" in sys.argv
    s = open(chemin, encoding="utf-8").read()

    if verifier:
        restes = []
        for nom, motif in MOTIFS_INTERDITS:
            trouves = re.findall(motif, s)
            if trouves:
                restes.append(f"  {nom} : {len(trouves)} occurrence(s)")
        if restes:
            print("SCHEMA NON PUBLIABLE :")
            print("\n".join(restes))
            return 1
        print("schema propre : aucun motif interdit")
        return 0

    total = 0
    for nom, regle in REGLES:
        s, n = regle(s)
        total += n
        print(f"  {nom:38} {n:>4} remplacement(s)")

    open(chemin, "w", encoding="utf-8").write(s)
    print(f"\n{total} remplacements ecrits dans {chemin}")

    restes = [nom for nom, motif in MOTIFS_INTERDITS if re.search(motif, s)]
    if restes:
        print(f"ATTENTION, motifs encore presents : {', '.join(restes)}")
        return 1
    print("aucun motif interdit ne subsiste")
    return 0


sys.exit(main())
