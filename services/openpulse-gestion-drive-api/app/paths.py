"""Normalisation et sécurisation des chemins Drive.

Règles (plan §6/§13) :
- le chemin utilisateur n'est JAMAIS la clé primaire du blob ;
- rejet path traversal (`..`), caractères de contrôle, chemins vides ;
- normalisation en `/segments/like/this` (slash initial, pas de slash final).
"""

from __future__ import annotations

import re
import unicodedata

_FORBIDDEN_SEGMENTS = {"", ".", ".."}
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
# Fichiers temporaires à ignorer côté sync (plan §15)
_IGNORED_PATTERNS = (
    re.compile(r"^~\$"),        # ~$rapport.docx (lock Office)
    re.compile(r"\.tmp$", re.I),
    re.compile(r"^\.DS_Store$"),
    re.compile(r"^Thumbs\.db$", re.I),
)


class InvalidPathError(ValueError):
    """Chemin Drive invalide (traversal, vide, caractères interdits)."""


def normalize_drive_path(raw: str) -> str:
    """Normalise un chemin logique Drive. Lève InvalidPathError si dangereux."""
    if raw is None:
        raise InvalidPathError("path manquant")
    path = unicodedata.normalize("NFC", raw).replace("\\", "/").strip()
    if _CONTROL_CHARS.search(path):
        raise InvalidPathError("caractères de contrôle interdits")
    segments = [s.strip() for s in path.split("/")]
    cleaned: list[str] = []
    for seg in segments:
        if seg == "":
            continue
        if seg in _FORBIDDEN_SEGMENTS:
            raise InvalidPathError(f"segment interdit: {seg!r}")
        cleaned.append(seg)
    if not cleaned:
        raise InvalidPathError("chemin vide")
    if len("/".join(cleaned)) > 1024:
        raise InvalidPathError("chemin trop long")
    return "/" + "/".join(cleaned)


def parent_path(path: str) -> str | None:
    """Chemin du dossier parent, ou None si à la racine."""
    parts = path.rsplit("/", 1)
    return parts[0] or None if len(parts) == 2 and parts[0] else None


def file_name(path: str) -> str:
    return path.rsplit("/", 1)[-1]


def safe_blob_filename(name: str) -> str:
    """Nom de fichier sûr pour le suffixe du blob (jamais utilisé comme clé)."""
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._") or "file"
    return name[:200]


def is_ignored_name(name: str) -> bool:
    """Fichier temporaire/OS à ignorer par la sync."""
    return any(p.search(name) for p in _IGNORED_PATTERNS)


def blob_name_for_file(space_id: str, file_id: str, filename: str) -> str:
    """spaces/{space_id}/files/{file_id}/current/{safe_filename}"""
    return f"spaces/{space_id}/files/{file_id}/current/{safe_blob_filename(filename)}"


def blob_name_for_version(space_id: str, file_id: str, version: int, filename: str) -> str:
    """spaces/{space_id}/files/{file_id}/versions/v{n}/{safe_filename}"""
    return f"spaces/{space_id}/files/{file_id}/versions/v{version}/{safe_blob_filename(filename)}"
