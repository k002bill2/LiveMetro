/**
 * Bottom Tab Component — 실제 활성 탭 네비게이터 기준 (2026-08-14 현행화)
 *
 * 활성 탭은 src/navigation/RootNavigator.tsx의 MainTabNavigator다:
 * 홈 / 즐겨찾기 / 경로 / 제보 / 설정 (CI run 31727330570 스크린샷 실증).
 * src/navigation/AppNavigator.tsx의 MainTabs(알림 탭 포함)는 렌더되지 않는
 * 죽은 코드다 — 이전 버전이 그걸 근거로 '알림' 탭을 찾다 전멸했다.
 *
 * 탭 버튼은 react-navigation이 testID를 주지 않으므로 라벨 텍스트로 찾는다.
 * 탭 이동 검증은 각 화면의 testID 마커로 한다 — 탭 버튼의 selected 속성은
 * 판정이 비결정적이라 쓰지 않는다 (run 31727330570에서 즐겨찾기만 true,
 * 홈·설정 false로 관측됨).
 */
import { BasePage } from '../base.page';

class BottomTabComponent extends BasePage {
  // ============ ACTIONS ============

  async tapHome(): Promise<void> {
    await this.safeTap(await this.getByText('홈'));
  }

  async tapFavorites(): Promise<void> {
    await this.safeTap(await this.getByText('즐겨찾기'));
  }

  async tapRoutes(): Promise<void> {
    await this.safeTap(await this.getByText('경로'));
  }

  async tapReports(): Promise<void> {
    await this.safeTap(await this.getByText('제보'));
  }

  async tapSettings(): Promise<void> {
    await this.safeTap(await this.getByText('설정'));
  }

  // ============ ASSERTIONS ============

  /** 탭 바 표시 여부 (홈 탭 라벨 기준) */
  async isVisible(): Promise<boolean> {
    try {
      const homeTab = await this.getByText('홈');
      return await homeTab.isDisplayed();
    } catch {
      return false;
    }
  }
}

export default new BottomTabComponent();
