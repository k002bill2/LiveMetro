# Firebase 설정 가이드

계정 생성이 실패하는 경우 아래 체크리스트를 확인하세요.

## ✅ 체크리스트

### 1. Firebase 프로젝트 확인
- [ ] Firebase Console (https://console.firebase.google.com)에 접속
- [ ] 프로젝트 `livemetro-cc092`가 존재하는지 확인
- [ ] 프로젝트에 접근 권한이 있는지 확인

### 2. Authentication 활성화 ⚠️ **가장 중요**
1. Firebase Console > Authentication 메뉴 선택
2. "Sign-in method" 탭 클릭
3. "Email/Password" 인증 방법 찾기
4. **"사용 설정"으로 변경**
5. 저장

**확인 방법:**
- Email/Password 항목이 "사용 설정됨" 상태여야 합니다
- 회색으로 "사용 중지됨"이라고 표시되면 활성화가 안 된 것입니다

### 3. Firestore Database 설정
1. Firebase Console > Firestore Database 메뉴 선택
2. 데이터베이스가 생성되어 있는지 확인
3. "규칙" 탭 클릭
4. 다음 규칙으로 설정:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - 본인 데이터만 읽기/쓰기 가능
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Subway data - 인증된 사용자만 읽기 가능
    match /stations/{document=**} {
      allow read: if request.auth != null;
    }

    match /subwayLines/{document=**} {
      allow read: if request.auth != null;
    }

    match /trains/{document=**} {
      allow read: if request.auth != null;
    }

    // 기타 모든 문서 - 인증된 사용자만 읽기
    match /{document=**} {
      allow read: if request.auth != null;
    }
  }
}
```

5. "게시" 버튼 클릭

### 4. 환경 변수 확인
1. 프로젝트 루트에 `.env` 파일이 있는지 확인
2. 파일에 다음 값들이 설정되어 있는지 확인:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyArkmevCGo4T4fUqU4uN7vZUZBYg5culXU
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=livemetro-cc092.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=livemetro-cc092
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=livemetro-cc092.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=450020925480
EXPO_PUBLIC_FIREBASE_APP_ID=1:450020925480:web:7edf434219fde3a2d9951d
```

3. 값이 `your_`, `development-` 등으로 시작하지 않는지 확인
4. `.env` 파일 수정 후 **반드시 앱을 재시작**

### 5. 네트워크 확인
- [ ] 인터넷 연결 확인
- [ ] 방화벽이 Firebase 도메인을 차단하지 않는지 확인
- [ ] VPN 사용 중이라면 비활성화 후 시도

## 🔍 에러 유형별 해결 방법

### "auth/operation-not-allowed" 에러
**원인:** Firebase 콘솔에서 이메일/비밀번호 인증이 비활성화됨

**해결:**
1. Firebase Console > Authentication > Sign-in method
2. Email/Password를 "사용 설정"으로 변경

### "permission-denied" 에러
**원인:** Firestore 보안 규칙이 너무 제한적

**해결:**
1. Firebase Console > Firestore Database > 규칙
2. 위의 보안 규칙 적용
3. "게시" 클릭

### "auth/email-already-in-use" 에러
**원인:** 이미 등록된 이메일

**해결:**
- 다른 이메일 주소 사용
- 또는 로그인 시도

### "auth/weak-password" 에러
**원인:** 비밀번호가 6자 미만

**해결:**
- 최소 6자 이상의 비밀번호 사용

### "auth/network-request-failed" 에러
**원인:** 네트워크 연결 문제

**해결:**
- 인터넷 연결 확인
- Wi-Fi/모바일 데이터 전환
- 앱 재시작

## 🛠️ 디버깅 방법

### 1. 콘솔 로그 확인
앱 실행 시 콘솔에서 다음 메시지를 확인:

```
Firebase initialized with project: livemetro-cc092
```

이 메시지가 보이지 않으면 Firebase 초기화 실패입니다.

### 2. 에러 분석
계정 생성/로그인 실패 시 콘솔에 자세한 진단 정보가 출력됩니다:

```
========================================
🔍 Firebase 진단 결과
========================================

설정 상태: ✅ 정상
에러 유형: AUTH_DISABLED

권장 사항:
⚠️ Firebase 콘솔에서 이메일/비밀번호 인증이 활성화되지 않았습니다.
...
```

### 3. Firebase 연결 테스트
개발자 도구에서 다음 명령 실행:

```javascript
import { testFirebaseConnection } from './src/utils/firebaseDebug';
testFirebaseConnection();
```

## 📞 추가 도움

위의 모든 단계를 시도해도 문제가 해결되지 않으면:

1. Firebase Console에서 프로젝트 설정 > 일반 탭 확인
2. 앱 ID가 `.env` 파일과 일치하는지 확인
3. Firebase SDK 버전 확인 (package.json)
4. 앱 완전히 종료 후 재시작
5. `node_modules` 삭제 후 `npm install` 재실행

## ✨ 성공 확인

모든 설정이 완료되면:
1. 앱에서 "계정 만들기" 선택
2. 이메일, 비밀번호, 이름 입력
3. "계정 만들기" 버튼 클릭
4. "계정이 생성되었습니다!" 메시지 표시
5. 자동으로 홈 화면으로 이동

Firebase Console > Authentication > Users 탭에서 생성된 계정을 확인할 수 있습니다.
