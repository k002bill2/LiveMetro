#!/usr/bin/env python3
"""
사용자 신뢰도 점수 계산 스크립트.
리포트 이력, 검증 결과, 활동 패턴에 기반한 신뢰도 산출.

Usage:
    echo '{"reports": 50, "verified": 45, "flagged": 2}' | python trust-score-calculator.py
    python trust-score-calculator.py --simulate
"""

import json
import math
import sys
from typing import NamedTuple


class TrustScore(NamedTuple):
    score: float          # 0.0 ~ 1.0
    level: str            # "new" | "basic" | "trusted" | "expert" | "flagged"
    badges: list[str]     # 획득한 뱃지 목록
    details: dict         # 세부 점수


# 뱃지 정의
BADGES = {
    "first_report": {"label": "첫 리포트", "condition": lambda s: s["total_reports"] >= 1},
    "active_10": {"label": "활동가 (10)", "condition": lambda s: s["total_reports"] >= 10},
    "active_50": {"label": "베테랑 (50)", "condition": lambda s: s["total_reports"] >= 50},
    "active_100": {"label": "마스터 (100)", "condition": lambda s: s["total_reports"] >= 100},
    "accurate_90": {"label": "정확도 90%+", "condition": lambda s: s["accuracy"] >= 0.9 and s["total_reports"] >= 10},
    "streak_7": {"label": "7일 연속", "condition": lambda s: s.get("streak_days", 0) >= 7},
    "early_adopter": {"label": "얼리어답터", "condition": lambda s: s.get("joined_early", False)},
}

# 신뢰도 레벨 구간
TRUST_LEVELS = [
    (0.0, 0.2, "flagged"),
    (0.2, 0.4, "new"),
    (0.4, 0.6, "basic"),
    (0.6, 0.8, "trusted"),
    (0.8, 1.0, "expert"),
]


def calculate_trust_score(
    total_reports: int,
    verified_reports: int,
    flagged_reports: int = 0,
    account_age_days: int = 30,
    streak_days: int = 0,
    community_upvotes: int = 0,
) -> TrustScore:
    """종합 신뢰도 점수 산출."""

    # 1. 정확도 점수 (0~1)
    accuracy = verified_reports / max(total_reports, 1)
    accuracy_score = accuracy * 0.4

    # 2. 활동량 점수 (로그 스케일, 최대 0.25)
    activity_score = min(math.log(total_reports + 1) / math.log(200), 1.0) * 0.25

    # 3. 계정 숙성도 (0~0.15)
    age_score = min(account_age_days / 180, 1.0) * 0.15

    # 4. 커뮤니티 점수 (0~0.1)
    community_score = min(community_upvotes / 50, 1.0) * 0.1

    # 5. 페널티 (-0.1 per flagged)
    penalty = min(flagged_reports * 0.1, 0.5)

    # 6. 연속 활동 보너스 (0~0.1)
    streak_bonus = min(streak_days / 30, 1.0) * 0.1

    raw_score = accuracy_score + activity_score + age_score + community_score + streak_bonus - penalty
    score = max(0.0, min(1.0, raw_score))

    # 레벨 결정
    level = "new"
    for low, high, lvl in TRUST_LEVELS:
        if low <= score < high:
            level = lvl
            break
    if score >= 0.8:
        level = "expert"

    # 뱃지 산출
    stats = {
        "total_reports": total_reports,
        "accuracy": accuracy,
        "streak_days": streak_days,
        "joined_early": account_age_days > 365,
    }
    earned_badges = [bid for bid, b in BADGES.items() if b["condition"](stats)]

    return TrustScore(
        score=round(score, 3),
        level=level,
        badges=earned_badges,
        details={
            "accuracy_score": round(accuracy_score, 3),
            "activity_score": round(activity_score, 3),
            "age_score": round(age_score, 3),
            "community_score": round(community_score, 3),
            "streak_bonus": round(streak_bonus, 3),
            "penalty": round(penalty, 3),
        }
    )


def detect_fraud(user_data: dict) -> dict:
    """부정행위 탐지."""
    flags: list[str] = []

    # 짧은 시간에 대량 리포트
    reports_per_hour = user_data.get("reports_last_hour", 0)
    if reports_per_hour > 20:
        flags.append(f"Rate limit exceeded: {reports_per_hour} reports/hour")

    # 동일 역 반복 리포트
    same_station_pct = user_data.get("same_station_percentage", 0)
    if same_station_pct > 0.8 and user_data.get("total_reports", 0) > 10:
        flags.append(f"Single station bias: {same_station_pct*100:.0f}% same station")

    # 항상 극단적 혼잡도
    extreme_pct = user_data.get("extreme_level_percentage", 0)
    if extreme_pct > 0.7 and user_data.get("total_reports", 0) > 5:
        flags.append(f"Extreme bias: {extreme_pct*100:.0f}% reports at level 1 or 5")

    return {
        "flagged": len(flags) > 0,
        "flags": flags,
        "risk_level": "high" if len(flags) >= 2 else ("medium" if len(flags) == 1 else "low")
    }


if __name__ == "__main__":
    if "--simulate" in sys.argv:
        scenarios = [
            {"label": "New user", "total_reports": 3, "verified_reports": 2, "account_age_days": 5},
            {"label": "Active user", "total_reports": 50, "verified_reports": 45, "account_age_days": 90, "streak_days": 14},
            {"label": "Expert user", "total_reports": 150, "verified_reports": 140, "account_age_days": 400, "streak_days": 30, "community_upvotes": 60},
            {"label": "Flagged user", "total_reports": 30, "verified_reports": 10, "flagged_reports": 8, "account_age_days": 20},
        ]
        for s in scenarios:
            label = s.pop("label")
            result = calculate_trust_score(**s)
            print(f"\n{label}: score={result.score}, level={result.level}, badges={result.badges}")
            print(f"  details: {result.details}")
    else:
        data = json.load(sys.stdin)
        result = calculate_trust_score(
            total_reports=data.get("reports", 0),
            verified_reports=data.get("verified", 0),
            flagged_reports=data.get("flagged", 0),
            account_age_days=data.get("account_age_days", 30),
            streak_days=data.get("streak_days", 0),
            community_upvotes=data.get("community_upvotes", 0),
        )
        print(json.dumps({"score": result.score, "level": result.level, "badges": result.badges, "details": result.details}, ensure_ascii=False, indent=2))
