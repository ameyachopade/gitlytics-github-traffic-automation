"""Regenerate requirements.txt with PyPI SHA-256 hashes.

AF2-ACT-07: the action job holds a repo-scoped PAT and a contents:write token,
so every third-party package must be pinned byte-for-byte. This script keeps
the lockfile reproducible:

    python tools/gen_requirements_hashes.py

It rewrites ``requirements.txt`` in the repository root. ``gitlytics`` itself
is installed separately (``--no-deps``) because it is not published on PyPI
yet (AF2-ACT-01); once it is, add its hash here and drop ``--no-deps`` from
``action.yml``.
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

# Keep this list aligned with gitlytics/requirements.txt plus the transitive
# dependencies of those packages for CPython 3.11 on Linux.
PINS = {
    "requests": "2.34.2",
    "certifi": "2026.10.23",
    "charset-normalizer": "3.5.2",
    "idna": "3.20",
    "urllib3": "2.8.0",
    "pandas": "3.1.1",
    "numpy": "2.4.6",  # newest numpy that still supports Python 3.11
    "python-dateutil": "4.0.0",
    "tzdata": "2026.6",
    "croniter": "7.0.0",
}

HEADER = """# Hash-pinned runtime dependencies for the Gitlytics traffic sync action.
#
# AF2-ACT-07: the action runs inside a job that holds a repo-scoped PAT and a
# contents:write GITHUB_TOKEN, so every third-party package it installs must be
# byte-for-byte pinned. Install with:
#
#   python -m pip install --no-cache-dir --disable-pip-version-check \\
#     --require-hashes -r requirements.txt
#
# `gitlytics` itself is installed separately with --no-deps because it is not
# on PyPI yet (AF2-ACT-01); once it is published, add its hash here and drop
# --no-deps. Regenerate this file with tools/gen_requirements_hashes.py.
"""


def main() -> None:
    lines = [HEADER, "--only-binary=:all:"]
    for name, version in PINS.items():
        url = f"https://pypi.org/pypi/{name}/{version}/json"
        with urllib.request.urlopen(url, timeout=60) as response:
            data = json.load(response)
        wheels = [
            item
            for item in data["urls"]
            if item["packagetype"] == "bdist_wheel"
            and item.get("digests", {}).get("sha256")
        ]
        if not wheels:
            raise SystemExit(f"no wheels published for {name}=={version}")
        hashes = sorted({item["digests"]["sha256"] for item in wheels})
        entries = " \\\n    ".join(f"--hash=sha256:{digest}" for digest in hashes)
        lines.append(f"{name}=={version} \\\n    {entries}")
        print(f"{name}=={version}: {len(hashes)} wheel hashes")

    root = Path(__file__).resolve().parent.parent
    target = root / "requirements.txt"
    target.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {target}")


if __name__ == "__main__":
    main()
