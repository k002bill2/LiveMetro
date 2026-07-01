import {
  clampScale,
  clampTranslate,
  focalZoom,
  toTransform,
  MIN_SCALE,
  MAX_SCALE,
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
