#!/usr/bin/env python3
"""
번역 키 추출 스크립트.
소스 코드에서 i18n 번역 키를 스캔하고, 누락된 번역을 식별합니다.

Usage:
    python extract-translations.py --scan src/
    python extract-translations.py --check src/locales/ko.json
    python extract-translations.py --generate-template
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Set


# i18n 함수 호출 패턴
I18N_PATTERNS = [
    re.compile(r"""t\(['"]([^'"]+)['"]\)"""),           # t('key')
    re.compile(r"""i18n\.t\(['"]([^'"]+)['"]\)"""),      # i18n.t('key')
    re.compile(r"""translate\(['"]([^'"]+)['"]\)"""),     # translate('key')
    re.compile(r"""useTranslation.*?['"]([^'"]+)['"]"""), # namespace
]

# 스캔 대상 확장자
SCAN_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx"}

# 제외 디렉토리
SKIP_DIRS = {"node_modules", "__tests__", "dist", "build", ".git"}


def scan_translation_keys(root_dir: str) -> Set[str]:
    """소스 코드에서 번역 키 추출."""
    keys: Set[str] = set()

    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        for filename in filenames:
            ext = Path(filename).suffix
            if ext not in SCAN_EXTENSIONS:
                continue

            filepath = os.path.join(dirpath, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

                for pattern in I18N_PATTERNS:
                    matches = pattern.findall(content)
                    keys.update(matches)
            except (UnicodeDecodeError, PermissionError):
                continue

    return keys


def check_missing_translations(keys: Set[str], locale_file: str) -> dict:
    """번역 파일에서 누락된 키 확인."""
    with open(locale_file, "r", encoding="utf-8") as f:
        translations = json.load(f)

    flat_keys = flatten_dict(translations)
    existing = set(flat_keys.keys())

    missing = keys - existing
    unused = existing - keys

    return {
        "total_keys_in_code": len(keys),
        "total_keys_in_locale": len(existing),
        "missing": sorted(missing),
        "unused": sorted(unused),
        "coverage": f"{len(existing & keys) / max(len(keys), 1) * 100:.1f}%"
    }


def flatten_dict(d: dict, prefix: str = "") -> dict:
    """중첩 딕셔너리를 플랫 키로 변환."""
    items: dict = {}
    for k, v in d.items():
        new_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(flatten_dict(v, new_key))
        else:
            items[new_key] = v
    return items


def generate_template(keys: Set[str]) -> dict:
    """키 목록에서 번역 템플릿 생성."""
    template: dict = {}
    for key in sorted(keys):
        parts = key.split(".")
        current = template
        for part in parts[:-1]:
            current = current.setdefault(part, {})
        current[parts[-1]] = f"[TODO: {key}]"
    return template


if __name__ == "__main__":
    if "--scan" in sys.argv:
        idx = sys.argv.index("--scan")
        root = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else "src/"
        keys = scan_translation_keys(root)
        print(f"Found {len(keys)} translation keys:")
        for k in sorted(keys):
            print(f"  {k}")

    elif "--check" in sys.argv:
        idx = sys.argv.index("--check")
        locale_file = sys.argv[idx + 1]
        scan_root = sys.argv[sys.argv.index("--scan") + 1] if "--scan" in sys.argv else "src/"
        keys = scan_translation_keys(scan_root)
        result = check_missing_translations(keys, locale_file)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(1 if result["missing"] else 0)

    elif "--generate-template" in sys.argv:
        scan_root = sys.argv[sys.argv.index("--scan") + 1] if "--scan" in sys.argv else "src/"
        keys = scan_translation_keys(scan_root)
        template = generate_template(keys)
        print(json.dumps(template, ensure_ascii=False, indent=2))

    else:
        print("Usage: extract-translations.py --scan <dir> | --check <locale.json> | --generate-template")
        sys.exit(1)
