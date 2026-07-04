import {
  clampScale,
  clampTranslate,
  focalZoom,
  panFrame,
  pinchFrame,
  toTransform,
  MIN_SCALE,
  MAX_SCALE,
  type GestureFrame,
} from '@components/map/subwayMapGestureMath';

describe('clampScale', () => {
  it('상한 초과를 MAX_SCALE로 자른다', () => {
    expect(clampScale(10)).toBe(MAX_SCALE);
  });
  it('하한 미만을 MIN_SCALE로 자른다', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE);
  });
  it('범위 내 값은 그대로 둔다', () => {
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe('clampTranslate', () => {
  const content = { width: 1000, height: 800 };

  it('스케일된 콘텐츠가 뷰포트보다 크면 가장자리를 넘지 못한다', () => {
    // scaledW = 2000 > viewport 400. 유효 x 범위 = [400-2000, 0] = [-1600, 0]
    const viewport = { width: 400, height: 400 };
    const tooFarLeft = clampTranslate({ x: 500, y: 0 }, 2, content, viewport);
    expect(tooFarLeft.x).toBe(0); // max 0을 넘지 못함
    const tooFarRight = clampTranslate({ x: -9999, y: 0 }, 2, content, viewport);
    expect(tooFarRight.x).toBe(400 - 2000); // min = -1600
  });

  it('스케일된 콘텐츠가 뷰포트보다 작으면 가운데 정렬한다', () => {
    // scaledW = 500 < viewport 1000 → x = (1000-500)/2 = 250
    const viewport = { width: 1000, height: 2000 };
    const centered = clampTranslate({ x: -777, y: 12 }, 0.5, content, viewport);
    expect(centered.x).toBe(250); // (1000 - 500)/2
    expect(centered.y).toBe((2000 - 400) / 2); // scaledH = 400 < 2000 → 800
  });

  it('범위 내 translate는 그대로 둔다', () => {
    const viewport = { width: 400, height: 400 };
    const inRange = clampTranslate({ x: -100, y: -50 }, 2, content, viewport);
    expect(inRange).toEqual({ x: -100, y: -50 });
  });
});

describe('focalZoom', () => {
  it('초점 아래 콘텐츠 지점을 고정한다 (좌상단 원점 모델)', () => {
    // 모델: screen = content*scale + translate → content = (focal - translate)/scale
    const focal = { x: 200, y: 100 };
    const prevScale = 1;
    const nextScale = 2;
    const prevTranslate = { x: -50, y: -30 };
    const contentAtFocalBefore = {
      x: (focal.x - prevTranslate.x) / prevScale,
      y: (focal.y - prevTranslate.y) / prevScale,
    };
    const next = focalZoom(focal, prevScale, nextScale, prevTranslate);
    const contentAtFocalAfter = {
      x: (focal.x - next.x) / nextScale,
      y: (focal.y - next.y) / nextScale,
    };
    expect(contentAtFocalAfter.x).toBeCloseTo(contentAtFocalBefore.x, 6);
    expect(contentAtFocalAfter.y).toBeCloseTo(contentAtFocalBefore.y, 6);
  });

  it('scale 변화가 없으면 translate를 바꾸지 않는다', () => {
    const t = { x: 5, y: 9 };
    expect(focalZoom({ x: 1, y: 1 }, 1.5, 1.5, t)).toEqual(t);
  });
});

describe('panFrame', () => {
  const content = { width: 1000, height: 800 };
  const viewport = { width: 400, height: 400 };

  it('현재 translate에 프레임 델타를 더한다 (범위 내)', () => {
    const frame: GestureFrame = { scale: 2, translate: { x: -300, y: -200 } };
    const next = panFrame(frame, { x: 15, y: -10 }, content, viewport);
    expect(next).toEqual({ x: -285, y: -210 });
  });

  it('경계를 넘는 델타는 클램프한다', () => {
    // scale 2 → scaledW 2000, 유효 x 범위 [-1600, 0]
    const frame: GestureFrame = { scale: 2, translate: { x: -5, y: -100 } };
    const next = panFrame(frame, { x: 50, y: 0 }, content, viewport);
    expect(next.x).toBe(0);
    expect(next.y).toBe(-100);
  });

  it('핀치가 바꾼 translate 위에 합성된다 (덮어쓰기 아님)', () => {
    // 증분 모델의 핵심: 이전 프레임에서 pinch가 만든 translate를 기반으로 누적
    const afterPinch = pinchFrame(
      { scale: 1, translate: { x: -300, y: -200 } },
      { x: 200, y: 200 },
      1.5,
      content,
      viewport,
    );
    const next = panFrame(afterPinch, { x: 10, y: 10 }, content, viewport);
    expect(next.x).toBeCloseTo(afterPinch.translate.x + 10, 6);
    expect(next.y).toBeCloseTo(afterPinch.translate.y + 10, 6);
  });
});

describe('pinchFrame', () => {
  const content = { width: 1000, height: 800 };
  const viewport = { width: 400, height: 400 };

  it('프레임 비율만큼 scale을 갱신하고 초점 아래 콘텐츠를 고정한다', () => {
    const frame: GestureFrame = { scale: 1, translate: { x: -300, y: -200 } };
    const focal = { x: 200, y: 200 };
    const contentAtFocalBefore = {
      x: (focal.x - frame.translate.x) / frame.scale,
      y: (focal.y - frame.translate.y) / frame.scale,
    };
    const next = pinchFrame(frame, focal, 1.25, content, viewport);
    expect(next.scale).toBeCloseTo(1.25, 6);
    expect((focal.x - next.translate.x) / next.scale).toBeCloseTo(contentAtFocalBefore.x, 6);
    expect((focal.y - next.translate.y) / next.scale).toBeCloseTo(contentAtFocalBefore.y, 6);
  });

  it('MAX_SCALE에서 추가 줌인은 scale·translate를 바꾸지 않는다', () => {
    const frame: GestureFrame = { scale: MAX_SCALE, translate: { x: -1000, y: -700 } };
    const next = pinchFrame(frame, { x: 200, y: 200 }, 1.1, content, viewport);
    expect(next.scale).toBe(MAX_SCALE);
    expect(next.translate).toEqual(frame.translate);
  });

  it('MIN_SCALE에서 추가 줌아웃은 scale을 바꾸지 않는다', () => {
    // scale 0.5 → scaledW 500 > 400? yes(500>400), scaledH 400 == viewport → 세로는 센터 고정
    const frame: GestureFrame = { scale: MIN_SCALE, translate: { x: -50, y: 0 } };
    const next = pinchFrame(frame, { x: 200, y: 200 }, 0.9, content, viewport);
    expect(next.scale).toBe(MIN_SCALE);
    expect(next.translate).toEqual(frame.translate);
  });

  it('결과 translate가 경계를 벗어나면 클램프한다', () => {
    // translate 0(상한)에서 줌아웃 → focalZoom 결과 (50,50)이 양수로 밀림 → 0으로 클램프
    const frame: GestureFrame = { scale: 2, translate: { x: 0, y: 0 } };
    const next = pinchFrame(frame, { x: 200, y: 200 }, 0.75, content, viewport);
    expect(next.translate.x).toBe(0);
    expect(next.translate.y).toBe(0);
  });
});

describe('핀치+팬 프레임 합성 (회귀: 초점이 다른 곳으로 튕기는 버그)', () => {
  const content = { width: 1000, height: 800 };
  const viewport = { width: 400, height: 400 };

  it('손가락이 움직이며 줌인해도 매 프레임 초점 아래 콘텐츠가 고정된다', () => {
    let state: GestureFrame = { scale: 1, translate: { x: -300, y: -200 } };
    let focal = { x: 200, y: 200 };
    const fingerDelta = { x: 5, y: -3 };
    const contentAtFocal0 = {
      x: (focal.x - state.translate.x) / state.scale,
      y: (focal.y - state.translate.y) / state.scale,
    };

    for (let i = 0; i < 10; i += 1) {
      // 두 손가락 midpoint 이동 → Pan.onChange 델타 + focal 이동
      focal = { x: focal.x + fingerDelta.x, y: focal.y + fingerDelta.y };
      state = { ...state, translate: panFrame(state, fingerDelta, content, viewport) };
      // 같은 프레임의 Pinch.onChange 증분 줌
      state = pinchFrame(state, focal, 1.05, content, viewport);

      const contentAtFocal = {
        x: (focal.x - state.translate.x) / state.scale,
        y: (focal.y - state.translate.y) / state.scale,
      };
      expect(contentAtFocal.x).toBeCloseTo(contentAtFocal0.x, 6);
      expect(contentAtFocal.y).toBeCloseTo(contentAtFocal0.y, 6);
    }
    expect(state.scale).toBeCloseTo(1.05 ** 10, 6);
  });

  it('손가락이 움직이며 줌아웃해도 매 프레임 초점 아래 콘텐츠가 고정된다', () => {
    let state: GestureFrame = { scale: 2.5, translate: { x: -900, y: -700 } };
    let focal = { x: 250, y: 150 };
    const fingerDelta = { x: -4, y: 6 };
    const contentAtFocal0 = {
      x: (focal.x - state.translate.x) / state.scale,
      y: (focal.y - state.translate.y) / state.scale,
    };

    for (let i = 0; i < 10; i += 1) {
      focal = { x: focal.x + fingerDelta.x, y: focal.y + fingerDelta.y };
      state = { ...state, translate: panFrame(state, fingerDelta, content, viewport) };
      state = pinchFrame(state, focal, 0.96, content, viewport);

      const contentAtFocal = {
        x: (focal.x - state.translate.x) / state.scale,
        y: (focal.y - state.translate.y) / state.scale,
      };
      expect(contentAtFocal.x).toBeCloseTo(contentAtFocal0.x, 6);
      expect(contentAtFocal.y).toBeCloseTo(contentAtFocal0.y, 6);
    }
    expect(state.scale).toBeCloseTo(2.5 * 0.96 ** 10, 6);
  });
});

describe('toTransform', () => {
  const content = { width: 1000, height: 800 };

  it('scale=1이면 중심 보정항이 0이라 translate가 그대로 반영된다', () => {
    const arr = toTransform(1, { x: 12, y: 34 }, content);
    expect(arr).toEqual([
      { translateX: 12 },
      { translateY: 34 },
      { scale: 1 },
    ]);
  });

  it('scale!=1이면 중심 원점 보정 (W/2)(1-scale)를 뺀다', () => {
    // translateX = t.x - (content.width/2)*(1-scale) = 0 - 500*(1-2) = 500
    const arr = toTransform(2, { x: 0, y: 0 }, content);
    expect(arr[0]).toEqual({ translateX: 0 - 500 * (1 - 2) }); // 500
    expect(arr[1]).toEqual({ translateY: 0 - 400 * (1 - 2) }); // 400
    expect(arr[2]).toEqual({ scale: 2 });
  });
});
