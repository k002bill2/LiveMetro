#!/usr/bin/env python3
"""
서울 지하철 요금 계산 유틸리티.
거리 비례 요금, 환승 할인, 요금 타입별 계산을 지원합니다.

Usage:
    python fare-calculator.py --from 강남 --to 서울역
    python fare-calculator.py --distance 15 --type adult
    echo '{"distance_km": 12}' | python fare-calculator.py --stdin
"""

import json
import sys
from typing import NamedTuple


class FareResult(NamedTuple):
    base_fare: int
    distance_fare: int
    total_fare: int
    fare_type: str
    distance_km: float


# 2024년 기준 서울 지하철 요금 체계
FARE_TABLE = {
    "adult": {"base": 1400, "base_distance_km": 10, "extra_per_5km": 100, "extra_threshold_km": 50, "extra_per_8km_after": 100},
    "youth": {"base": 720, "base_distance_km": 10, "extra_per_5km": 80, "extra_threshold_km": 50, "extra_per_8km_after": 80},
    "child": {"base": 450, "base_distance_km": 10, "extra_per_5km": 50, "extra_threshold_km": 50, "extra_per_8km_after": 50},
    "senior": {"base": 0, "base_distance_km": 999, "extra_per_5km": 0, "extra_threshold_km": 999, "extra_per_8km_after": 0},
}

TRANSFER_DISCOUNT = {
    "bus_to_subway": 0,      # 환승 무료 (통합 요금)
    "subway_to_bus": 0,
    "different_operator": 0,  # 수도권 통합 환승
}


def calculate_fare(distance_km: float, fare_type: str = "adult") -> FareResult:
    """거리 기반 요금 계산."""
    table = FARE_TABLE.get(fare_type, FARE_TABLE["adult"])

    base_fare = table["base"]

    if distance_km <= table["base_distance_km"]:
        return FareResult(base_fare, 0, base_fare, fare_type, distance_km)

    extra_distance = distance_km - table["base_distance_km"]

    if distance_km <= table["extra_threshold_km"]:
        extra_units = (extra_distance + 4.99) // 5  # 5km 단위 올림
        distance_fare = int(extra_units * table["extra_per_5km"])
    else:
        # 50km까지 5km 단위
        first_part = (table["extra_threshold_km"] - table["base_distance_km"]) // 5
        first_fare = first_part * table["extra_per_5km"]
        # 50km 이후 8km 단위
        remaining = distance_km - table["extra_threshold_km"]
        second_units = (remaining + 7.99) // 8
        second_fare = int(second_units * table["extra_per_8km_after"])
        distance_fare = int(first_fare + second_fare)

    return FareResult(base_fare, distance_fare, base_fare + distance_fare, fare_type, distance_km)


def format_result(result: FareResult) -> dict:
    """결과를 JSON 직렬화 가능한 딕셔너리로 변환."""
    return {
        "baseFare": result.base_fare,
        "distanceFare": result.distance_fare,
        "totalFare": result.total_fare,
        "fareType": result.fare_type,
        "distanceKm": result.distance_km,
        "formatted": f"{result.total_fare:,}원"
    }


if __name__ == "__main__":
    if "--stdin" in sys.argv:
        data = json.load(sys.stdin)
        dist = data.get("distance_km", 10)
        ft = data.get("fare_type", "adult")
    else:
        dist = float(sys.argv[sys.argv.index("--distance") + 1]) if "--distance" in sys.argv else 10
        ft = sys.argv[sys.argv.index("--type") + 1] if "--type" in sys.argv else "adult"

    result = calculate_fare(dist, ft)
    print(json.dumps(format_result(result), ensure_ascii=False, indent=2))
