#!/usr/bin/env python3
"""Smoke test HTTP du socle Gestion Drive (équivalent des curls du plan §14).

Usage : python scripts/smoke.py [base_url]   (défaut http://127.0.0.1:8735)
"""

import hashlib
import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8735"


def call(method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def main() -> None:
    print("1) health:", json.dumps(call("GET", "/healthz")))

    space = call("POST", "/api/drive/spaces",
                 {"name": "Espace Smoke", "slug": "smoke", "type": "gsi"})
    print("2) space créé:", space["id"], space["slug"])

    sha = hashlib.sha256(b"contenu de preuve").hexdigest()
    intent = call("POST", "/api/drive/upload-intent", {
        "space_id": space["id"], "path": "/DPO/Contrats/preuve-hds.pdf",
        "size_bytes": 42, "sha256": sha,
    })
    print("3) upload-intent:", intent["action"], "v" + str(intent["version"]),
          "blob=" + intent["blob_name"])
    assert intent["upload_url"], "upload_url manquant"

    done = call("POST", "/api/drive/upload-complete", {
        "upload_token": intent["upload_token"],
        "file_id": intent["file_id"], "version": intent["version"], "etag": "e1",
    })
    print("4) upload-complete: status=" + done["file"]["status"],
          "event_id=" + str(done["event_id"]))

    dl = call("POST", "/api/drive/download-url", {"file_id": intent["file_id"]})
    print("5) download-url:", dl["download_url"][:80] + "...")

    tree = call("GET", f"/api/drive/tree?space_id={space['id']}")
    print("6) tree:", [f["path"] for f in tree["folders"]],
          [f["path"] for f in tree["files"]])

    changes = call("GET", f"/api/drive/changes?space_id={space['id']}&since_event_id=0")
    print("7) changes:", [e["event_type"] for e in changes["events"]],
          "last_event_id=" + str(changes["last_event_id"]))

    print("\nSMOKE OK")


if __name__ == "__main__":
    main()
