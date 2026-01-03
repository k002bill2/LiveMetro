/**
 * Help Content - FAQ Data
 * Questions and answers for the Help screen
 */

export interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export const FAQ_CATEGORIES = [
  '알림',
  '즐겨찾기',
  '위치 서비스',
  '계정',
  '기타',
] as const;

export const FAQ_DATA: FAQItem[] = [
  // 알림 관련
  {
    id: 'notification-1',
    category: '알림',
    question: '알림이 오지 않아요',
    answer:
      '알림이 오지 않는 경우 다음을 확인해주세요:\n\n1. 설정 > 소리 설정에서 "푸시 알림"이 켜져 있는지 확인\n2. 기기의 설정 > 알림에서 LiveMetro 앱 알림이 허용되어 있는지 확인\n3. 설정 > 지연 알림에서 알림이 활성화되어 있는지 확인\n4. 방해 금지 모드가 활성화되어 있지 않은지 확인\n\n그래도 문제가 해결되지 않으면 support@livemetro.app로 문의해주세요.',
  },
  {
    id: 'notification-2',
    category: '알림',
    question: '알림 시간을 변경하려면?',
    answer:
      '알림 시간을 변경하려면:\n\n1. 설정 탭으로 이동\n2. "알림 시간대" 선택\n3. 아침/저녁 출퇴근 시간 설정\n4. 조용한 시간대를 설정하여 특정 시간에는 알림을 받지 않을 수 있습니다\n\n출퇴근 시간을 설정하면 해당 시간대에 맞춤 알림을 받을 수 있습니다.',
  },
  {
    id: 'notification-3',
    category: '알림',
    question: '지연 기준 시간은 어떻게 설정하나요?',
    answer:
      '지연 기준 시간 설정 방법:\n\n1. 설정 > 지연 알림으로 이동\n2. "알림 기준 시간" 슬라이더를 조정\n3. 5분에서 30분 사이로 설정 가능\n\n예를 들어 10분으로 설정하면, 열차가 정상 운행 시간보다 10분 이상 지연될 때 알림을 받게 됩니다.',
  },

  // 즐겨찾기 관련
  {
    id: 'favorites-1',
    category: '즐겨찾기',
    question: '즐겨찾기 추가 방법',
    answer:
      '즐겨찾기를 추가하는 방법:\n\n1. 홈 화면에서 역을 검색하거나 선택\n2. 역 상세 화면에서 별 아이콘 탭\n3. 즐겨찾기 탭에서 "+" 버튼을 눌러 직접 추가\n\n즐겨찾기에 추가한 역은 빠르게 접근할 수 있으며, 해당 역의 지연 알림을 받을 수 있습니다.',
  },
  {
    id: 'favorites-2',
    category: '즐겨찾기',
    question: '즐겨찾기 순서 변경',
    answer:
      '즐겨찾기 순서를 변경하려면:\n\n1. 즐겨찾기 탭으로 이동\n2. 역 카드를 길게 누르기(Long Press)\n3. 원하는 위치로 드래그\n\n자주 이용하는 역을 위로 배치하면 더 빠르게 접근할 수 있습니다.',
  },
  {
    id: 'favorites-3',
    category: '즐겨찾기',
    question: '즐겨찾기에 별명을 붙일 수 있나요?',
    answer:
      '네, 가능합니다:\n\n1. 즐겨찾기 탭에서 역 카드를 탭\n2. "별명 설정" 선택\n3. 원하는 별명 입력 (예: "집", "회사", "학교")\n\n별명을 설정하면 즐겨찾기에서 쉽게 구분할 수 있습니다.',
  },

  // 위치 서비스 관련
  {
    id: 'location-1',
    category: '위치 서비스',
    question: '위치 권한이 필요한 이유',
    answer:
      'LiveMetro는 다음 기능을 위해 위치 권한이 필요합니다:\n\n1. 주변 역 찾기: 현재 위치에서 가까운 지하철역 자동 검색\n2. 출퇴근 경로 추천: 자주 이용하는 경로 분석 및 추천\n3. 맞춤 알림: 위치 기반 실시간 지연 알림\n\n위치 정보는 기기에만 저장되며 서버로 전송되지 않습니다. 개인정보는 안전하게 보호됩니다.',
  },
  {
    id: 'location-2',
    category: '위치 서비스',
    question: '위치 권한을 거부했는데 다시 허용하려면?',
    answer:
      '위치 권한을 다시 허용하려면:\n\n**iOS:**\n1. 설정 > LiveMetro\n2. 위치 > "앱 사용 중" 선택\n\n**Android:**\n1. 설정 > 앱 > LiveMetro\n2. 권한 > 위치 > 허용\n\n또는 앱 내 설정 > 위치 권한 화면에서 "앱 설정 열기" 버튼을 눌러 바로 이동할 수 있습니다.',
  },

  // 계정 관련
  {
    id: 'account-1',
    category: '계정',
    question: '계정을 삭제하려면?',
    answer:
      '계정 삭제는 다음 절차를 따라주세요:\n\n1. support@livemetro.app로 이메일 발송\n2. 제목: "계정 삭제 요청"\n3. 본문에 등록된 이메일 주소 포함\n\n계정 삭제 시 모든 데이터가 영구 삭제되며 복구할 수 없습니다. 신중하게 결정해주세요.',
  },
  {
    id: 'account-2',
    category: '계정',
    question: '비밀번호를 잊어버렸어요',
    answer:
      '비밀번호를 재설정하려면:\n\n1. 로그인 화면에서 "비밀번호 찾기" 선택\n2. 등록된 이메일 주소 입력\n3. 이메일로 전송된 링크를 통해 비밀번호 재설정\n\n이메일이 오지 않는 경우 스팸 폴더를 확인해주세요.',
  },

  // 기타
  {
    id: 'other-1',
    category: '기타',
    question: '앱이 느려요',
    answer:
      '앱이 느린 경우 다음을 시도해보세요:\n\n1. 앱을 완전히 종료 후 다시 실행\n2. 기기 재시작\n3. 앱 업데이트 확인 (최신 버전 사용)\n4. 기기 저장 공간 확인 (여유 공간 확보)\n\n문제가 지속되면 앱 정보(설정 > 앱 정보)를 확인하여 support@livemetro.app로 문의해주세요.',
  },
  {
    id: 'other-2',
    category: '기타',
    question: '데이터 사용량이 궁금해요',
    answer:
      'LiveMetro는 최소한의 데이터만 사용합니다:\n\n- 평균 월 사용량: 약 50MB\n- 주로 실시간 열차 도착 정보 수신\n- Wi-Fi 연결 시 자동 업데이트\n\nWi-Fi가 아닌 환경에서는 데이터 사용을 최소화하도록 최적화되어 있습니다.',
  },
  {
    id: 'other-3',
    category: '기타',
    question: '오프라인에서도 사용할 수 있나요?',
    answer:
      'LiveMetro는 제한적인 오프라인 기능을 제공합니다:\n\n**가능한 기능:**\n- 즐겨찾기 역 목록 확인\n- 노선도 보기\n- 캐시된 역 정보 확인\n\n**불가능한 기능:**\n- 실시간 열차 도착 정보\n- 지연 알림\n- 새로운 역 검색\n\n최상의 경험을 위해서는 인터넷 연결이 필요합니다.',
  },
];

export const SUPPORT_EMAIL = 'support@livemetro.app';
export const SUPPORT_PHONE = '1234-5678';

export default FAQ_DATA;
