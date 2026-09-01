/**
 * 실시간 열차정보 API 테스트 스크립트 (v2)
 * 서울 지하철 Open API 연결 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config();

// 키는 환경변수 전용 — 하드코딩 폴백을 두면 레포에 시크릿이 남고, 조용히 남의 키로
// 호출해 INFO-100 같은 진짜 실패를 가린다. 미설정이면 즉시 중단한다.
const RAW_API_KEY = process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY;
if (!RAW_API_KEY) {
  throw new Error(
    'EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY 가 설정되지 않았습니다. .env 에 추가한 뒤 다시 실행하세요.'
  );
}
// 모듈 스코프의 가드는 함수 본문까지 좁힘이 이어지지 않으므로 좁혀진 값을 상수로 고정한다.
const API_KEY: string = RAW_API_KEY;

/**
 * 키가 섞일 수 있는 모든 문자열의 마지막 관문. 첫 한 번만 지우는 `String.replace(문자열)`
 * 과 달리 모든 출현을 지운다 — BASE_URL 에 키가 들어 있으면 요청 URL 에 두 번 나타난다.
 * split/join 을 쓰는 이유는 키가 정규식 메타문자를 포함해도 안전하기 때문이다.
 *
 * BASE_URL 보다 먼저 선언한다 — 아래 스킴 검증도 마스킹을 쓸 수 있어야 하기 때문이다.
 */
const maskKey = (text: string): string => text.split(API_KEY).join('***');

/**
 * 로그용 문자열화. null·undefined·빈 문자열을 모두 'N/A' 로 모은다 — 빈 문자열을 그대로
 * 흘리면 로그에 라벨만 남아 "필드가 비었다"와 "필드를 못 읽었다"가 구분되지 않는다.
 *
 * falsy 일괄 판정(`value || 'N/A'`)을 쓰지 않는 이유: 0(초 단위 도착·인덱스)과 false 는
 * 정당한 값이라 그대로 찍혀야 한다. null 검사 → 문자열화 → 빈 문자열 검사 순서만이
 * 그 둘을 보존한다.
 */
const safeLogValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'N/A';
  const text = String(value);
  return text === '' ? 'N/A' : maskKey(text);
};

// 기본값은 http 다 — 서울 실시간 API 는 HTTPS 를 제공하지 않는다(443 은 TLS 연결
// 자체가 실패). 같은 사실 위에 `plugins/withSeoulApiCleartext.js` 가 Android
// cleartext 예외를, `app.json` 이 iOS ATS 예외를 두 도메인에만 걸어두고 있다.
// 앱 런타임(`seoulSubwayApi.ts`, `officialDelayService.ts`)도 같은 http 를 쓴다.
const DEFAULT_BASE_URL = 'http://swopenapi.seoul.go.kr/api/subway';
const configuredBaseUrl = process.env.SEOUL_SUBWAY_API_BASE_URL;
// 평문 http 는 API 키가 URL path segment 에 실려 나가 경로 상의 누구나 읽을 수 있다.
// 서버가 https 를 열어주지 않는 한 코드로 없앨 수 없는 위험이라 차단이 아니라 경고로
// 남긴다. 경고문에 설정값 자체는 싣지 않는다: 그 값에도 키가 박혀 있을 수 있다.
const BASE_URL = configuredBaseUrl || DEFAULT_BASE_URL;
if (!/^https:\/\//i.test(BASE_URL)) {
  console.warn(
    '⚠️  평문 http 로 요청합니다. URL 경로의 API 키가 그대로 노출됩니다 ' +
      '(서울 실시간 API 는 https 미지원 — 진단용 스크립트에서만 사용하세요).'
  );
}

async function testRealtimeArrival(stationName: string): Promise<void> {
  console.log('='.repeat(60));
  console.log(`🚇 실시간 열차정보 API 테스트`);
  console.log(`📍 역명: ${safeLogValue(stationName)}`);
  console.log(`🔑 API Key: (환경변수에서 로드됨)`);
  // BASE_URL 도 환경변수라 키가 박혀 있을 수 있다 — 원문 출력 금지.
  console.log(`🌐 Base URL: ${safeLogValue(BASE_URL)}`);
  console.log('='.repeat(60));

  const url = `${BASE_URL}/${API_KEY}/json/realtimeStationArrival/0/10/${encodeURIComponent(stationName)}`;
  
  // 로그에 키를 남기지 않는다 — URL path segment 에 키가 그대로 들어간다.
  console.log(`\n📡 요청 URL: ${maskKey(url)}\n`);

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LiveMetro/1.0'
      }
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      // statusText 는 상류가 되돌려주는 값이라 요청 URL(= 키 포함)을 되받아 적을 수 있다.
      console.log(`❌ HTTP 오류: ${safeLogValue(response.status)} ${safeLogValue(response.statusText)}`);
      return;
    }

    const data = await response.json();

    console.log(`⏱️  응답 시간: ${safeLogValue(elapsed)}ms`);
    console.log(`📦 HTTP 상태: ${safeLogValue(response.status)} OK\n`);

    // 전체 응답 구조 출력 (디버깅용)
    console.log('📄 전체 응답 키:', safeLogValue(Object.keys(data).join(', ')));
    
    // errorMessage가 실제 에러인지 확인 (INFO-000은 정상)
    if (data.errorMessage && data.errorMessage.code !== 'INFO-000') {
      console.log(`❌ API 오류:`);
      // 서울 API 에러 본문도 상류 문자열이다 — 인증 실패 메시지가 키를 되비칠 수 있다.
      // data 는 any 라 maskKey 에 그대로 넘기면 tsc 는 통과하고 런타임에 터진다. String() 필수.
      console.log(`   Code: ${safeLogValue(data.errorMessage.code)}`);
      console.log(`   Message: ${safeLogValue(data.errorMessage.message)}`);
      return;
    }

    // 결과 출력
    const arrivals = data.realtimeArrivalList || [];
    console.log(`\n✅ 도착정보 ${safeLogValue(arrivals.length)}건 수신\n`);

    if (arrivals.length === 0) {
      console.log('⚠️  현재 도착 예정 열차가 없습니다.');
      console.log('   (심야 시간대이거나 운행 중단 상태일 수 있습니다)');
      return;
    }

    console.log('📋 실시간 도착 정보:');
    console.log('-'.repeat(60));

    arrivals.forEach((arr: any, idx: number) => {
      const lineInfo = arr.trainLineNm || `${arr.subwayId}호선`;
      const direction = arr.updnLine || 'N/A';
      
      console.log(`\n[${safeLogValue(idx + 1)}] ${safeLogValue(lineInfo)}`);
      console.log(`   📍 역명: ${safeLogValue(arr.statnNm || stationName)}`);
      console.log(`   🔄 방향: ${safeLogValue(direction)}`);
      console.log(`   🚂 열차번호: ${safeLogValue(arr.btrainNo)}`);
      console.log(`   🎯 행선지: ${safeLogValue(arr.bstatnNm)}`);
      console.log(`   ⏰ 도착예정: ${safeLogValue(arr.arvlMsg2 || arr.arvlMsg3)}`);
      console.log(`   📊 상태코드: ${safeLogValue(getStatusText(arr.arvlCd))}`);
      console.log(`   🕐 수신시각: ${safeLogValue(arr.recptnDt)}`);
    });

    console.log('\n' + '-'.repeat(60));
    console.log('✅ API 테스트 성공!');
    console.log(`📊 총 ${safeLogValue(arrivals.length)}개의 열차 도착 정보 확인됨`);

  } catch (error) {
    // fetch 실패 메시지·원인에 요청 URL(= 키 포함)이 실려 나올 수 있다.
    console.log(`❌ 요청 실패: ${safeLogValue(error instanceof Error ? error.message : error)}`);
  }
}

function getStatusText(code: string): string {
  const statusMap: Record<string, string> = {
    '0': '진입',
    '1': '도착',
    '2': '출발',
    '3': '전역출발',
    '4': '전역진입',
    '5': '전역도착'
  };
  return statusMap[code] || `${code}`;
}

// 여러 역 테스트
async function runMultipleTests(): Promise<void> {
  const testStations = ['강남', '서울역', '홍대입구'];
  
  for (const station of testStations) {
    await testRealtimeArrival(station);
    console.log('\n\n');
    // 연속 요청 방지를 위한 딜레이
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

// 명령행 인자 확인
const args = process.argv.slice(2);
if (args.includes('--all')) {
  runMultipleTests();
} else {
  const targetStation = args[0] || '강남';
  testRealtimeArrival(targetStation);
}
