/**
 * Legal document content — Wanted handoff settings-detail-2.jsx
 * (PRIVACY_SECTIONS / TERMS_SECTIONS, lines 536-605).
 *
 * Body text is the legal source of truth; do not paraphrase. Module-level
 * readonly consts so both screens and tests share one copy.
 */

import type { LegalSection } from '@/components/settings/LegalDocumentScreen';

export interface LegalDocumentMeta {
  readonly version: string;
  readonly lastUpdated: string;
  readonly intro: string;
}

export const PRIVACY_POLICY_META: LegalDocumentMeta = {
  version: '3.2',
  lastUpdated: '2025년 11월 1일',
  intro:
    'LiveMetro는 이용자의 개인정보를 소중히 다루며, 관련 법령(개인정보 보호법 등)을 준수합니다. 본 방침은 회사가 수집·이용·보관·파기하는 개인정보의 범위와 절차를 설명합니다.',
} as const;

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    num: '제 1 조',
    title: '개인정보의 수집 항목 및 방법',
    body: [
      '주식회사 라이브메트로(이하 "회사")는 LiveMetro 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.',
      '필수 항목: 이메일, 비밀번호(암호화), 휴대전화번호, 출퇴근 역 정보, 디바이스 식별자.',
      '선택 항목: 프로필 사진, 지연 제보 시 작성된 텍스트 및 이미지, 푸시 알림 토큰.',
      '자동 수집 항목: 접속 IP, 쿠키, 서비스 이용 기록, 기기 OS 버전, 앱 버전.',
    ],
  },
  {
    num: '제 2 조',
    title: '개인정보의 이용 목적',
    body: [
      '회원 식별 및 본인 확인, 부정 이용 방지.',
      '실시간 열차 도착 정보 및 지연 알림 제공.',
      '머신러닝 기반 출퇴근 시간 예측 모델 개선(기기 내 처리).',
      '서비스 공지, 이벤트 및 마케팅 정보 제공(별도 동의 시).',
    ],
  },
  {
    num: '제 3 조',
    title: '개인정보의 보유 및 이용 기간',
    body: [
      '회원 탈퇴 시 즉시 파기를 원칙으로 합니다.',
      '단, 관계 법령에 따라 보존이 필요한 정보는 해당 기간 동안 보관합니다.',
      '계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)',
      '소비자 불만 또는 분쟁 처리 기록: 3년',
      '접속 로그 기록: 3개월 (통신비밀보호법)',
    ],
  },
  {
    num: '제 4 조',
    title: '개인정보의 제3자 제공',
    body: [
      '회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.',
      '법령에 근거가 있거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우는 예외로 합니다.',
    ],
  },
  {
    num: '제 5 조',
    title: '이용자의 권리와 행사 방법',
    body: [
      '이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.',
      '요청은 앱 내 [설정 → 계정 → 개인정보 관리] 또는 privacy@livemetro.kr 로 신청할 수 있습니다.',
    ],
  },
] as const;

export const TERMS_OF_SERVICE_META: LegalDocumentMeta = {
  version: '2.4',
  lastUpdated: '2025년 10월 15일',
  intro:
    '본 약관은 LiveMetro 서비스를 이용하시는 모든 분께 적용됩니다. 회원 가입 시 본 약관에 동의한 것으로 간주되며, 변경 사항은 앱 내 공지를 통해 안내됩니다.',
} as const;

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    num: '제 1 조',
    title: '목적',
    body: [
      '이 약관은 주식회사 라이브메트로(이하 "회사")가 제공하는 LiveMetro 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리·의무·책임 사항을 규정함을 목적으로 합니다.',
    ],
  },
  {
    num: '제 2 조',
    title: '용어의 정의',
    body: [
      '"서비스"란 회사가 제공하는 실시간 지하철 도착 정보, 지연 알림, 출퇴근 예측 등 일체의 모바일 애플리케이션 기능을 의미합니다.',
      '"이용자"란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.',
      '"회원"이란 회사와 이용계약을 체결한 자로서, 회원 ID를 부여받은 이용자를 말합니다.',
    ],
  },
  {
    num: '제 3 조',
    title: '약관의 효력 및 변경',
    body: [
      '이 약관은 서비스를 이용하고자 하는 모든 이용자에게 그 효력이 발생합니다.',
      '회사는 합리적인 사유가 발생할 경우 약관을 변경할 수 있으며, 변경 시 시행일 7일 이전부터 공지합니다.',
      '이용자에게 불리한 변경의 경우 30일 이전에 공지하고 이메일 등으로 개별 통지합니다.',
    ],
  },
  {
    num: '제 4 조',
    title: '서비스의 제공 및 중단',
    body: [
      '회사는 연중무휴, 1일 24시간 서비스를 제공함을 원칙으로 합니다.',
      '단, 시스템 점검·교체·장애, 통신 두절 등의 사유가 발생한 경우 서비스 제공을 일시 중단할 수 있습니다.',
      '실시간 도착 정보는 운영기관(서울교통공사 등)의 데이터에 의존하므로, 해당 데이터 장애 시 정확도가 저하될 수 있습니다.',
    ],
  },
  {
    num: '제 5 조',
    title: '이용자의 의무',
    body: [
      '이용자는 타인의 개인정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.',
      '허위 지연 제보, 욕설, 광고성 글 등 다른 이용자에게 피해를 주는 행위는 금지됩니다.',
      '위반 시 회사는 서비스 이용을 제한하거나 회원 자격을 박탈할 수 있습니다.',
    ],
  },
  {
    num: '제 6 조',
    title: '면책 조항',
    body: [
      '회사는 천재지변, 운영기관의 데이터 오류, 통신 두절 등 불가항력적 사유로 인한 서비스 장애에 대해 책임을 지지 않습니다.',
      '서비스에서 제공하는 정보는 참고용이며, 이를 근거로 한 결정으로 발생한 손해에 대해 회사는 책임지지 않습니다.',
    ],
  },
] as const;
