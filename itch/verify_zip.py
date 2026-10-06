"""Check that the upload bundle is complete and self-contained.

    ./itch/build_zip.sh && python3 itch/verify_zip.py

The failure this guards against is quiet: someone adds an asset to index.html,
forgets to add it to build_zip.sh, and the game ships to a games portal with a
missing stylesheet. Nothing in the normal test suite would notice, because the
tests run against the repository rather than against the zip.
"""

from __future__ import annotations

import posixpath
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZIP = ROOT / "itch" / "beamline-web.zip"


def main() -> int:
    if not ZIP.exists():
        print(f"missing {ZIP.name}. Run ./itch/build_zip.sh", file=sys.stderr)
        return 1

    with zipfile.ZipFile(ZIP) as z:
        names = {n for n in z.namelist() if not n.endswith("/")}
        read = lambda n: z.read(n).decode("utf-8", "replace")  # noqa: E731

        problems = []
        if "index.html" not in names:
            problems.append("index.html is not at the root of the zip")

        wanted: set[str] = set()

        def add(ref: str, relative_to: str) -> None:
            """Resolve a reference against the file that made it, zip-style.

            CSS says url(../fonts/x.woff2) from inside css/, which has to become
            fonts/x.woff2 before it can be looked up in the archive. posixpath
            does this correctly; string munging does not, which is how the first
            version of this script reported two fonts missing that were sitting
            in the zip.
            """
            if ref.startswith(("http", "#", "mailto:", "data:")):
                return
            base = posixpath.dirname(relative_to)
            wanted.add(posixpath.normpath(posixpath.join(base, ref)).lstrip("/"))

        for ref in re.findall(r'(?:src|href)="([^"]+)"', read("index.html")):
            add(ref, "index.html")

        for name in sorted(names):
            if name.endswith(".js"):
                for m in re.findall(r'from "(\.[^"]+)"', read(name)):
                    add(m, name)
            elif name.endswith(".css"):
                for m in re.findall(r'url\(["\']?([^"\')]+)', read(name)):
                    add(m, name)

        for w in sorted(wanted):
            if w not in names:
                problems.append(f"referenced but not packaged: {w}")

        # Things that must never ship inside a game bundle.
        for name in names:
            if name.startswith(("tests/", "scripts/", "itch/", "node_modules/")) or name.endswith(".md"):
                problems.append(f"should not be in the bundle: {name}")

        print(f"{ZIP.name}: {len(names)} files, {ZIP.stat().st_size // 1024} KB")
        print(f"  references checked: {len(wanted)}")

        if problems:
            print("\nPROBLEMS:")
            for p in problems:
                print(f"  - {p}")
            return 1

    print("  bundle is complete and self-contained")
    return 0


if __name__ == "__main__":
    sys.exit(main())
