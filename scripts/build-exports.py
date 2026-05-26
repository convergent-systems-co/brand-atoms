#!/usr/bin/env python3
"""Build exports/catalog.json from atoms, compositions, and rules.

Reads ATOMS.yml for catalog metadata and composition directory name.
Validates each JSON file against its schema; exits 1 on failure.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import jsonschema
except ImportError:
    print("error: jsonschema not installed. Run: pip install jsonschema", file=sys.stderr)
    sys.exit(2)

try:
    import yaml
except ImportError:
    print("error: pyyaml not installed. Run: pip install pyyaml", file=sys.stderr)
    sys.exit(2)

REPO = Path(__file__).resolve().parent.parent
SCHEMA_DIR = REPO / "schemas"
ATOMS_DIR = REPO / "atoms"
RULES_DIR = REPO / "rules"

# Read catalog metadata from ATOMS.yml
_manifest = yaml.safe_load((REPO / "ATOMS.yml").read_text(encoding="utf-8"))
CATALOG_NAME = _manifest.get("name", REPO.name)
CATALOG_VERSION = str(_manifest.get("version", "0.1.0"))
_comp_dir = str(_manifest.get("composition_dir", "compositions")).rstrip("/")
COMPOSITIONS_DIR = REPO / _comp_dir

EXPORT_PATH = REPO / "exports" / "catalog.json"


def load_validator(name: str):
    path = SCHEMA_DIR / name
    if not path.exists():
        return None
    schema = json.loads(path.read_text(encoding="utf-8"))
    return jsonschema.Draft202012Validator(schema)


def collect(dir_path: Path, validator, label: str) -> list[dict]:
    if not dir_path.exists():
        return []
    out: list[dict] = []
    for path in sorted(dir_path.rglob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if validator:
            errors = list(validator.iter_errors(data))
            if errors:
                print(f"✗ {path.relative_to(REPO)} ({label}):", file=sys.stderr)
                for err in errors:
                    loc = "/".join(str(x) for x in err.absolute_path) or "<root>"
                    print(f"    {err.message} at {loc}", file=sys.stderr)
                sys.exit(1)
        out.append(data)
    return out


def main() -> int:
    atoms = collect(ATOMS_DIR, load_validator("atom-v1.json"), "atom")
    compositions = collect(COMPOSITIONS_DIR, load_validator("composition-v1.json"), "composition")
    rules = collect(RULES_DIR, load_validator("rule-v1.json"), "rule")

    catalog = {
        "catalog": CATALOG_NAME,
        "version": CATALOG_VERSION,
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "atoms": atoms,
        "compositions": compositions,
        "rules": rules,
    }

    EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXPORT_PATH.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        f"wrote {EXPORT_PATH.relative_to(REPO)}"
        f" — {len(atoms)} atoms, {len(compositions)} compositions, {len(rules)} rules"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
