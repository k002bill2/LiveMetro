#!/usr/bin/env python3
"""
혼잡도 크라우드소싱 데이터 검증 스크립트.
Firestore에 저장될 혼잡도 리포트의 유효성을 검증합니다.

Usage:
    python validate-congestion-data.py < report.json
    python validate-congestion-data.py --sample  # 샘플 데이터 생성
"""

import json
import sys
from datetime import datetime, timedelta
from typing import Any


VALID_LEVELS = [1, 2, 3, 4, 5]  # 1=여유, 5=매우혼잡
VALID_LINE_IDS = [
    "1호선", "2호선", "3호선", "4호선", "5호선",
    "6호선", "7호선", "8호선", "9호선",
    "경의중앙선", "분당선", "신분당선", "공항철도",
    "경춘선", "수인분당선", "GTX-A"
]
MAX_REPORT_AGE_MINUTES = 30
MIN_TRUST_SCORE = 0.3


def validate_report(report: dict[str, Any]) -> list[str]:
    """혼잡도 리포트 유효성 검증. 에러 목록 반환."""
    errors: list[str] = []

    # 필수 필드 확인
    required = ["stationId", "lineId", "level", "timestamp", "userId"]
    for field in required:
        if field not in report:
            errors.append(f"Missing required field: {field}")

    if errors:
        return errors

    # 혼잡도 레벨 범위
    if report["level"] not in VALID_LEVELS:
        errors.append(f"Invalid level {report['level']}, must be 1-5")

    # 노선 ID
    if report["lineId"] not in VALID_LINE_IDS:
        errors.append(f"Unknown lineId: {report['lineId']}")

    # 타임스탬프 신선도
    try:
        ts = datetime.fromisoformat(report["timestamp"].replace("Z", "+00:00"))
        age = datetime.now(ts.tzinfo) - ts
        if age > timedelta(minutes=MAX_REPORT_AGE_MINUTES):
            errors.append(f"Report too old: {age.total_seconds()//60:.0f}min")
        if age.total_seconds() < 0:
            errors.append("Future timestamp detected")
    except (ValueError, AttributeError):
        errors.append(f"Invalid timestamp format: {report.get('timestamp')}")

    # 신뢰도 점수 (옵션)
    trust = report.get("userTrustScore", 1.0)
    if trust < MIN_TRUST_SCORE:
        errors.append(f"Trust score too low: {trust} < {MIN_TRUST_SCORE}")

    return errors


def generate_sample() -> dict[str, Any]:
    """유효한 샘플 혼잡도 리포트 생성."""
    return {
        "stationId": "0222",
        "stationName": "강남",
        "lineId": "2호선",
        "level": 4,
        "direction": "내선",
        "carNumber": 5,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "userId": "user_abc123",
        "userTrustScore": 0.85,
        "source": "manual_report"
    }


if __name__ == "__main__":
    if "--sample" in sys.argv:
        print(json.dumps(generate_sample(), ensure_ascii=False, indent=2))
        sys.exit(0)

    data = json.load(sys.stdin)
    reports = data if isinstance(data, list) else [data]

    total_errors = 0
    for i, report in enumerate(reports):
        errs = validate_report(report)
        if errs:
            total_errors += len(errs)
            print(f"Report #{i}: INVALID")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"Report #{i}: VALID")

    sys.exit(1 if total_errors > 0 else 0)
