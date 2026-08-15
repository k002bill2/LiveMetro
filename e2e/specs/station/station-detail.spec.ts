/**
 * Station Detail E2E Tests — 즐겨찾기 경유 진입 (2026-08-14 구현)
 *
 * 진입 경로: 즐겨찾기 탭 → 검색 모달(+) → 2호선 강남 선택 → 카드 탭 → 상세.
 * 홈 주변 역 카드 경로는 CI 에뮬레이터 기본 좌표(미국)라 비결정적이어서
 * 쓰지 않는다.
 *
 * 검색 모달에서는 한글 IME 입력을 쓰지 않는다 — 호선 필터 탭 +
 * `station-search-item-강남` resource-id 대기라는 실증된 전략만 쓴다
 * (2호선 필터 안에서 '강남' 역명은 유일하다).
 *
 * 도착정보는 실행 시각·Seoul API 응답에 따라 도착 카드/빈/에러가 갈리므로
 * (nightly KST 02시는 운행 종료 시간대 → 보통 빈 상태) "로딩을 벗어나 셋 중
 * 하나에 도달한다"는 계약만 단언한다.
 *
 * 마지막 테스트는 추가한 즐겨찾기를 UI로 삭제한다 — 삭제 흐름 검증을 겸한
 * Firestore 잔여물 정리다 (익명 계정이라도 남기지 않는다).
 */
import entryFlow from '../../page-objects/onboarding/entry-flow';
import favoritesPage from '../../page-objects/favorites/favorites.page';
import bottomTab from '../../page-objects/components/bottom-tab.component';
import searchModal from '../../page-objects/components/station-search-modal.component';
import stationDetailPage from '../../page-objects/station/station-detail.page';

describe('Station Detail', () => {
  before(async () => {
    await entryFlow.enterMainAsAnonymous();
    await bottomTab.tapFavorites();
    await favoritesPage.waitForScreen();
  });

  after(async () => {
    // Best-effort 잔여물 정리 (Codex P2 — livemetro-workflow "e2e 잔여물
    // 방지"): 중간 테스트가 실패해도 익명 사용자의 즐겨찾기를 Firestore에
    // 남기지 않는다. 마지막 it가 정상 삭제했다면 행이 없어 no-op이다.
    // UI가 어느 화면에 멈췄는지 모르므로 전 단계를 방어적으로 감싼다.
    try {
      if (await stationDetailPage.isDisplayed()) {
        await stationDetailPage.tapBack();
      }
      await favoritesPage.waitForScreen(5000);
      if (await favoritesPage.elementExists('favorite-row-강남')) {
        await favoritesPage.safeTap(await favoritesPage.editButton);
        await favoritesPage.safeTap(await favoritesPage.selectCheckbox);
        await favoritesPage.safeTap(await favoritesPage.bulkDeleteButton);
        await favoritesPage.tapAlertButton('삭제');
        const emptyTitle = await favoritesPage.emptyTitle;
        await emptyTitle.waitForDisplayed({ timeout: 15000 });
      }
    } catch {
      // 정리 실패가 spec 결과를 오염시키지 않는다 — 다음 spec 파일은
      // fast reset으로 새 익명 사용자에서 시작하므로 기능 영향도 없다.
    }
  });

  it('즐겨찾기 추가(+) 버튼으로 역 검색 모달이 열린다', async () => {
    await favoritesPage.safeTap(await favoritesPage.addButton);
    await searchModal.waitForOpen();
    const input = await searchModal.searchInput;
    expect(await input.isDisplayed()).toBe(true);
  });

  it('2호선 강남역을 선택하면 즐겨찾기에 추가된다', async () => {
    await searchModal.tapLineFilter('2');
    await searchModal.tapStationItem('강남');
    // 모달이 닫히고 addFavorite(Firestore 왕복)이 끝나면 '완료' Alert가 뜬다.
    // 버튼 배열 없는 Alert.alert이라 확인 버튼은 RN 기본값 'OK'다.
    await searchModal.tapAlertButton('OK');
    const row = await favoritesPage.favoriteRow('강남');
    await row.waitForDisplayed({ timeout: 15000 });
    expect(await row.isDisplayed()).toBe(true);
  });

  it('즐겨찾기 카드를 탭하면 역 상세 화면으로 진입한다', async () => {
    await favoritesPage.safeTap(await favoritesPage.favoriteRow('강남'));
    await stationDetailPage.waitForScreen();
    expect(await stationDetailPage.isDisplayed()).toBe(true);
  });

  it('도착정보가 로딩을 벗어나 도착/빈/에러 중 한 상태에 도달한다', async () => {
    const state = await stationDetailPage.waitForArrivalState();
    expect(['arrivals', 'empty', 'error']).toContain(state);
  });

  it('뒤로 가서 추가한 즐겨찾기를 삭제한다 (잔여물 정리)', async () => {
    await stationDetailPage.tapBack();
    await favoritesPage.waitForScreen();
    // 전역 편집 모드 → 행 선택 → 일괄 삭제 → 확인 다이얼로그('삭제'는
    // 앱이 지정한 버튼 텍스트)
    await favoritesPage.safeTap(await favoritesPage.editButton);
    await favoritesPage.safeTap(await favoritesPage.selectCheckbox);
    await favoritesPage.safeTap(await favoritesPage.bulkDeleteButton);
    await favoritesPage.tapAlertButton('삭제');
    const emptyTitle = await favoritesPage.emptyTitle;
    await emptyTitle.waitForDisplayed({ timeout: 15000 });
    expect(await emptyTitle.isDisplayed()).toBe(true);
  });
});
