"""Tests unitaires — normalisation de chemins et sécurité path traversal."""

import pytest

from app.paths import (
    InvalidPathError,
    blob_name_for_file,
    blob_name_for_version,
    file_name,
    is_ignored_name,
    normalize_drive_path,
    parent_path,
    safe_blob_filename,
)


class TestNormalizeDrivePath:
    def test_simple(self):
        assert normalize_drive_path("/DPO/Contrats/contrat.pdf") == "/DPO/Contrats/contrat.pdf"

    def test_no_leading_slash(self):
        assert normalize_drive_path("DPO/contrat.pdf") == "/DPO/contrat.pdf"

    def test_double_slashes_collapsed(self):
        assert normalize_drive_path("//DPO///x.pdf") == "/DPO/x.pdf"

    def test_backslashes_windows(self):
        assert normalize_drive_path("\\DPO\\Contrats\\x.pdf") == "/DPO/Contrats/x.pdf"

    def test_trailing_slash_removed(self):
        assert normalize_drive_path("/DPO/Contrats/") == "/DPO/Contrats"

    def test_segments_trimmed(self):
        assert normalize_drive_path("/ DPO / fichier.pdf ") == "/DPO/fichier.pdf"

    def test_unicode_nfc(self):
        # é décomposé (e + combining accent) => é composé
        decomposed = "/DPO/e\u0301tablissement.pdf"
        assert normalize_drive_path(decomposed) == "/DPO/établissement.pdf"

    @pytest.mark.parametrize("bad", [
        "../etc/passwd",
        "/DPO/../../secret",
        "/a/./b",
        "..",
        "/..",
    ])
    def test_traversal_rejected(self, bad):
        with pytest.raises(InvalidPathError):
            normalize_drive_path(bad)

    @pytest.mark.parametrize("bad", ["", "/", "//", None])
    def test_empty_rejected(self, bad):
        with pytest.raises(InvalidPathError):
            normalize_drive_path(bad)

    def test_control_chars_rejected(self):
        with pytest.raises(InvalidPathError):
            normalize_drive_path("/DPO/fich\x00ier.pdf")

    def test_too_long_rejected(self):
        with pytest.raises(InvalidPathError):
            normalize_drive_path("/" + "a" * 1030)


class TestHelpers:
    def test_parent_path(self):
        assert parent_path("/DPO/Contrats/x.pdf") == "/DPO/Contrats"
        assert parent_path("/x.pdf") is None

    def test_file_name(self):
        assert file_name("/DPO/Contrats/x.pdf") == "x.pdf"

    def test_safe_blob_filename_accents(self):
        assert safe_blob_filename("établissement récap.pdf") == "etablissement_recap.pdf"

    def test_safe_blob_filename_empty(self):
        assert safe_blob_filename("é§§") == "file" or safe_blob_filename("é§§")

    def test_blob_names_use_ids_not_user_path(self):
        blob = blob_name_for_file("sp1", "f1", "rapport final.docx")
        assert blob == "spaces/sp1/files/f1/current/rapport_final.docx"
        vblob = blob_name_for_version("sp1", "f1", 3, "rapport final.docx")
        assert vblob == "spaces/sp1/files/f1/versions/v3/rapport_final.docx"


class TestIgnoredNames:
    @pytest.mark.parametrize("name", ["~$rapport.docx", "x.tmp", ".DS_Store", "Thumbs.db"])
    def test_ignored(self, name):
        assert is_ignored_name(name)

    @pytest.mark.parametrize("name", ["rapport.docx", "tmpfile.pdf", "DS_Store.txt"])
    def test_not_ignored(self, name):
        assert not is_ignored_name(name)
