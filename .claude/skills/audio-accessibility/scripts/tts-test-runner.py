#!/usr/bin/env python3
"""
TTS/접근성 안내 문구 테스트 스크립트.
역 안내 방송 문구를 생성하고 형식을 검증합니다.

Usage:
    python tts-test-runner.py --station 강남 --event arrival
    python tts-test-runner.py --validate-all
    python tts-test-runner.py --generate-fixtures
"""

import json
import sys
from typing import Optional


# TTS 안내 템플릿
ANNOUNCEMENT_TEMPLATES = {
    "arrival": {
        "ko": "이번 역은 {station}역입니다. {direction} 방면 열차가 {time}에 도착합니다.",
        "en": "This station is {station}. The train bound for {direction} will arrive at {time}."
    },
    "transfer": {
        "ko": "{station}역에서 {line}으로 환승하실 수 있습니다. 환승 예상 시간은 약 {minutes}분입니다.",
        "en": "You can transfer to {line} at {station} station. Estimated transfer time is {minutes} minutes."
    },
    "delay": {
        "ko": "{line} {direction} 방면 열차가 약 {minutes}분 지연되고 있습니다.",
        "en": "The {line} train bound for {direction} is delayed by approximately {minutes} minutes."
    },
    "congestion": {
        "ko": "{station}역 {direction} 방면 현재 혼잡도: {level}. {suggestion}",
        "en": "{station} station, {direction} bound. Current congestion: {level}. {suggestion}"
    }
}

CONGESTION_SUGGESTIONS = {
    1: {"ko": "좌석 여유가 있습니다.", "en": "Seats are available."},
    2: {"ko": "비교적 여유롭습니다.", "en": "Relatively spacious."},
    3: {"ko": "서있는 승객이 있습니다.", "en": "Some standing passengers."},
    4: {"ko": "혼잡합니다. 다음 열차를 이용해 주세요.", "en": "Crowded. Please consider the next train."},
    5: {"ko": "매우 혼잡합니다. 다음 열차를 이용해 주세요.", "en": "Very crowded. Please take the next train."}
}


def generate_announcement(
    event: str,
    station: str,
    lang: str = "ko",
    direction: Optional[str] = None,
    line: Optional[str] = None,
    time: Optional[str] = None,
    minutes: Optional[int] = None,
    level: Optional[int] = None
) -> str:
    """TTS 안내 문구 생성."""
    template = ANNOUNCEMENT_TEMPLATES.get(event, {}).get(lang)
    if not template:
        return f"[Unknown event: {event}]"

    suggestion = ""
    level_text = ""
    if level and level in CONGESTION_SUGGESTIONS:
        suggestion = CONGESTION_SUGGESTIONS[level][lang]
        level_names = {1: "여유", 2: "보통", 3: "약간혼잡", 4: "혼잡", 5: "매우혼잡"}
        level_text = level_names.get(level, str(level))

    return template.format(
        station=station,
        direction=direction or "상행",
        line=line or "",
        time=time or "",
        minutes=minutes or 0,
        level=level_text,
        suggestion=suggestion
    )


def validate_announcement(text: str) -> list[str]:
    """안내 문구 유효성 검증."""
    errors: list[str] = []

    if len(text) > 200:
        errors.append(f"Too long ({len(text)} chars, max 200) - TTS may truncate")
    if len(text) < 5:
        errors.append("Too short - likely template error")
    if "{" in text or "}" in text:
        errors.append("Unresolved template variables detected")
    if text.count("역역") > 0:
        errors.append("Duplicate '역' detected (e.g., '강남역역')")

    return errors


def generate_fixtures() -> list[dict]:
    """테스트 픽스처 생성."""
    return [
        {"event": "arrival", "station": "강남", "direction": "역삼", "time": "2분 후",
         "expected_ko": "이번 역은 강남역입니다. 역삼 방면 열차가 2분 후에 도착합니다."},
        {"event": "transfer", "station": "사당", "line": "4호선", "minutes": 3,
         "expected_ko": "사당역에서 4호선으로 환승하실 수 있습니다. 환승 예상 시간은 약 3분입니다."},
        {"event": "delay", "line": "2호선", "direction": "외선", "minutes": 5,
         "expected_ko": "2호선 외선 방면 열차가 약 5분 지연되고 있습니다."},
        {"event": "congestion", "station": "강남", "direction": "내선", "level": 4,
         "expected_ko": "강남역 내선 방면 현재 혼잡도: 혼잡. 혼잡합니다. 다음 열차를 이용해 주세요."},
    ]


if __name__ == "__main__":
    if "--generate-fixtures" in sys.argv:
        print(json.dumps(generate_fixtures(), ensure_ascii=False, indent=2))

    elif "--validate-all" in sys.argv:
        fixtures = generate_fixtures()
        all_valid = True
        for f in fixtures:
            text = generate_announcement(**{k: v for k, v in f.items() if not k.startswith("expected")})
            errors = validate_announcement(text)
            status = "PASS" if not errors else "FAIL"
            if errors:
                all_valid = False
            print(f"[{status}] {f['event']}: {text}")
            for e in errors:
                print(f"       {e}")
        sys.exit(0 if all_valid else 1)

    elif "--station" in sys.argv:
        idx = sys.argv.index("--station")
        station = sys.argv[idx + 1]
        event = sys.argv[sys.argv.index("--event") + 1] if "--event" in sys.argv else "arrival"
        text = generate_announcement(event, station, direction="상행", time="2분 후", minutes=3, level=3)
        print(text)

    else:
        print("Usage: tts-test-runner.py --station <name> --event <type> | --validate-all | --generate-fixtures")
