/**
 * 실시간 열차정보 API 테스트 스크립트 (v2)
 * 서울 지하철 Open API 연결 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY || '6d486a6a6a3030323630556c4e554f';
const BASE_URL = process.env.SEOUL_SUBWAY_API_BASE_URL || 'http://swopenapi.seoul.go.kr/api/subway';

async function testRealtimeArrival(stationName: string): Promise<void> {
  console.log('='.repeat(60));
  console.log(`🚇 실시간 열차정보 API 테스트`);
  console.log(`📍 역명: ${stationName}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log('='.repeat(60));

  const url = `${BASE_URL}/${API_KEY}/json/realtimeStationArrival/0/10/${encodeURIComponent(stationName)}`;
  
  console.log(`\n📡 요청 URL: ${url}\n`);

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
      console.log(`❌ HTTP 오류: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();

    console.log(`⏱️  응답 시간: ${elapsed}ms`);
    console.log(`📦 HTTP 상태: ${response.status} OK\n`);

    // 전체 응답 구조 출력 (디버깅용)
    console.log('📄 전체 응답 키:', Object.keys(data));
    
    // errorMessage가 실제 에러인지 확인 (INFO-000은 정상)
    if (data.errorMessage && data.errorMessage.code !== 'INFO-000') {
      console.log(`❌ API 오류:`);
      console.log(`   Code: ${data.errorMessage.code}`);
      console.log(`   Message: ${data.errorMessage.message}`);
      return;
    }

    // 결과 출력
    const arrivals = data.realtimeArrivalList || [];
    console.log(`\n✅ 도착정보 ${arrivals.length}건 수신\n`);

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
      
      console.log(`\n[${idx + 1}] ${lineInfo}`);
      console.log(`   📍 역명: ${arr.statnNm || stationName}`);
      console.log(`   🔄 방향: ${direction}`);
      console.log(`   🚂 열차번호: ${arr.btrainNo || 'N/A'}`);
      console.log(`   🎯 행선지: ${arr.bstatnNm || 'N/A'}`);
      console.log(`   ⏰ 도착예정: ${arr.arvlMsg2 || arr.arvlMsg3 || 'N/A'}`);
      console.log(`   📊 상태코드: ${getStatusText(arr.arvlCd)}`);
      console.log(`   🕐 수신시각: ${arr.recptnDt || 'N/A'}`);
    });

    console.log('\n' + '-'.repeat(60));
    console.log('✅ API 테스트 성공!');
    console.log(`📊 총 ${arrivals.length}개의 열차 도착 정보 확인됨`);

  } catch (error) {
    console.log(`❌ 요청 실패: ${error instanceof Error ? error.message : error}`);
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
