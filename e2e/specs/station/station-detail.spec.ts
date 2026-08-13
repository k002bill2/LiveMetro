/**
 * Station Detail E2E Tests — 의도적 보류 (2026-08-14 현행화 시점)
 *
 * 보류 사유: 역 상세 화면 진입은 (a) 즐겨찾기 추가 검색 모달을 통해 역을
 * 등록하거나 (b) 홈 주변 역 카드를 탭해야 하는데, (a)는 검색 모달 내부
 * testID 계약 정리가 선행돼야 하고 (b)는 CI 에뮬레이터 기본 좌표(미국)라
 * 주변 역이 잡히지 않아 결정적이지 않다.
 *
 * 후속 계획: 즐겨찾기 검색 모달(FavoritesScreen의 isSearchModalVisible 경로)에
 * testID를 부여한 뒤 "즐겨찾기 추가 → 역 선택 → 상세 진입 → 도착정보
 * 로딩/빈/에러 상태(station-detail-loading/empty/error) 검증" 흐름으로 구현한다.
 * 화면 자체의 testID(station-detail-header 등)는 이미 존재한다.
 */
describe.skip('Station Detail (보류 — 진입 경로 확정 후 구현)', () => {
  it('placeholder — 위 보류 사유 참조', () => {
    // intentionally skipped
  });
});
