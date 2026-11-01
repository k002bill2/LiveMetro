/**
 * wdio 10에서 `@wdio/globals`의 `WebdriverIO.Browser`/`Element`는 빈 인터페이스이고,
 * 실제 멤버는 `webdriverio` 타입의 `declare global` 확장이 채운다.
 * e2e/tsconfig.json은 `types: ["expect-webdriverio", ...]` 경유로 이 확장을 로드하지만,
 * 루트 `tsc --noEmit`(include `**\/*.ts`로 e2e 포함, types 미지정)은 로드하지 않아
 * `isDisplayed`/`saveScreenshot` 등이 TS2339가 된다. 타입 전용 import로 두 프로그램 모두에
 * 확장을 고정한다(런타임 코드 없음).
 */
import type {} from 'webdriverio';
