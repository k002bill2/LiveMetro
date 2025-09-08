# LiveMetro - App Store Deployment Guide

## Overview
Complete deployment preparation guide for LiveMetro app submission to iOS App Store and Google Play Store.

## 🚀 Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Install EAS CLI: `npm install -g @expo/eas-cli`
- [ ] Login to Expo account: `eas login`
- [ ] Verify project configuration: `eas build:configure`

### 2. Asset Requirements

#### App Icons
- [ ] **iOS App Store Icon**: 1024×1024 PNG (no alpha channel)
- [ ] **iOS Device Icons**: Generated automatically from 1024×1024
- [ ] **Android Play Store Icon**: 512×512 PNG
- [ ] **Android Adaptive Icon**: 432×432 PNG foreground + background layers

#### Screenshots (Required for Store Listing)
- [ ] **iPhone**: 6.7", 6.5", 5.5" display sizes
- [ ] **iPad**: 12.9" and 11" Pro display sizes  
- [ ] **Android**: Phone and Tablet (1080×1920, 1920×1080)

#### Promotional Graphics
- [ ] **App Store**: 1024×500 promotional image
- [ ] **Play Store**: 1024×500 feature graphic

### 3. Store Metadata

#### App Store Connect (iOS)
```
App Name: LiveMetro - 실시간 전철 알림
Subtitle: Seoul Subway Delay Alerts
Category: Navigation
Content Rating: 4+ (No objectionable content)

Description (Korean):
서울 지하철 실시간 알림으로 스마트한 출퇴근!
LiveMetro는 서울 지하철 1-9호선과 신분당선의 실시간 도착 정보와 지연 알림을 제공하는 스마트 통근 앱입니다.

주요 기능:
🚇 실시간 열차 도착 정보 및 지연 알림
🚨 운행 중단 및 장애 긴급 알림  
🗺️ 지연 시 대체 경로 자동 제안
⭐ 자주 이용하는 역 즐겨찾기 관리
🔔 출퇴근 시간대별 맞춤 알림 설정
📱 위치 기반 근처 지하철역 자동 감지

Description (English):
Smart commuting with real-time Seoul subway alerts!
LiveMetro provides real-time arrival information and delay notifications for Seoul subway lines 1-9 and Shinbundang line.

Key Features:
🚇 Real-time train arrivals and delay notifications
🚨 Service disruption emergency alerts
🗺️ Alternative route suggestions during delays
⭐ Favorite stations management
🔔 Time-based personalized notification settings
📱 Location-based nearby station detection

Keywords: 지하철,전철,서울,실시간,알림,출퇴근,교통,subway,metro,seoul,notification,commute,transport

Privacy Policy URL: https://livemetro.app/privacy-policy
Support URL: https://livemetro.app/support
```

#### Google Play Console (Android)
```
App Name: LiveMetro - Seoul Subway Alerts
Short Description: Real-time Seoul subway notifications with delay alerts and route suggestions
Category: Maps & Navigation
Content Rating: Everyone
Target Age Group: General Audience

Full Description (Korean):
서울 지하철 스마트 알림 앱 LiveMetro!
출퇴근 시간을 절약하고 지연 스트레스를 줄여보세요.

✨ 주요 기능
• 실시간 열차 도착 정보 (1-9호선, 신분당선)
• 지연/운행중단 즉시 알림
• AI 기반 대체 경로 자동 제안
• 위치 기반 근처 역 탐지
• 출퇴근 패턴 학습 맞춤 알림
• 즐겨찾는 역 관리

🎯 이런 분들께 추천
• 서울 지하철을 자주 이용하는 직장인/학생
• 지연으로 인한 시간 손실을 줄이고 싶은 분
• 스마트한 출퇴근 솔루션을 찾는 분

📱 사용법
1. 자주 이용하는 역을 즐겨찾기 등록
2. 출퇴근 시간대 알림 설정
3. 실시간 알림으로 스마트하게 이동!

개인정보 처리방침: https://livemetro.app/privacy-policy
고객 지원: https://livemetro.app/support

Full Description (English):
Smart Seoul subway alerts with LiveMetro!
Save commute time and reduce delay stress.

✨ Key Features
• Real-time train arrivals (Lines 1-9, Shinbundang)
• Instant delay/disruption notifications
• AI-powered alternative route suggestions
• Location-based nearby station detection
• Personalized alerts based on commute patterns
• Favorite stations management

🎯 Perfect for
• Office workers/students using Seoul subway frequently
• Anyone wanting to reduce time loss from delays
• Those seeking smart commuting solutions

📱 How to Use
1. Register frequently used stations as favorites
2. Set commute time notification preferences
3. Travel smart with real-time alerts!

Privacy Policy: https://livemetro.app/privacy-policy
Support: https://livemetro.app/support
```

## 🔧 Build Commands

### Development Build
```bash
# iOS Simulator
eas build --platform ios --profile development

# Android APK
eas build --platform android --profile development
```

### Production Build
```bash
# iOS App Store
eas build --platform ios --profile production-ios

# Android Play Store
eas build --platform android --profile production-android

# Both platforms
eas build --platform all --profile production
```

### Submission
```bash
# iOS App Store
eas submit --platform ios

# Google Play Store  
eas submit --platform android

# Check submission status
eas submit:list
```

## 📋 App Store Review Preparation

### iOS App Store Review Information
```
Demo Account (if required):
Username: demo@livemetro.app
Password: DemoUser2024!

Review Notes:
- This app uses location services to provide personalized subway alerts for Seoul metropolitan area
- Location permission is essential for core functionality (nearby station detection)
- Push notifications are used for real-time delay and disruption alerts
- The app connects to Seoul Metropolitan Government's public subway API
- All location data is processed locally and only used for notification purposes
- No sensitive user data is collected or transmitted
```

### Testing Instructions for Reviewers
```
1. Allow location permissions when prompted
2. Navigate to "Nearby Stations" to see location-based features
3. Add a station to favorites (e.g., "강남역" or "Gangnam Station")
4. Enable notifications in settings
5. The app will show real-time arrival information for Seoul subway lines
6. Location is used only for finding nearby stations and sending relevant alerts
```

## 🔒 Privacy & Compliance

### Privacy Policy Requirements
- [ ] Location data usage explanation
- [ ] Notification preferences and opt-out
- [ ] Data retention and deletion policies
- [ ] Third-party service integrations (Firebase, Seoul Open API)
- [ ] User rights and contact information

### GDPR & Privacy Compliance
- [ ] Explicit location permission requests
- [ ] Clear data usage explanations
- [ ] User control over data collection
- [ ] Data minimization practices
- [ ] Secure data transmission (HTTPS/TLS)

## 🚨 Critical Store Requirements

### iOS App Store
- [ ] **Location Permission**: Clearly explain why location is needed
- [ ] **Background Location**: Justify background location usage for alerts
- [ ] **Push Notifications**: Demonstrate notification value and user control
- [ ] **Content Accuracy**: Ensure Korean translations are accurate
- [ ] **Performance**: App should load within 3 seconds on 3G

### Google Play Store
- [ ] **Target API Level**: Android API level 33+ (Android 13)
- [ ] **App Bundle**: Use AAB format for Play Store submission
- [ ] **Permissions**: Minimize permission requests to essential only
- [ ] **Content Rating**: Ensure appropriate content rating selection
- [ ] **Privacy Policy**: Must be accessible via HTTPS URL

## 📊 Post-Launch Monitoring

### Analytics Setup
- [ ] Firebase Analytics for user engagement
- [ ] Crashlytics for error monitoring  
- [ ] Performance monitoring for app speed
- [ ] User feedback collection system

### Key Metrics to Track
- [ ] Daily/Monthly Active Users (DAU/MAU)
- [ ] Notification click-through rates
- [ ] App store rating and reviews
- [ ] Crash-free session percentage (target: >99.5%)
- [ ] App load time (target: <3 seconds)

## 🔄 Update Strategy

### Version Management
```
Current: 1.0.0 (Build 1)
Next Update: 1.0.1 (Bug fixes)
Major Update: 1.1.0 (New features)
```

### Release Schedule
- [ ] **Hotfixes**: Within 24-48 hours for critical issues
- [ ] **Minor Updates**: Weekly for improvements
- [ ] **Major Updates**: Monthly for new features
- [ ] **Store Review**: Allow 24-48 hours for iOS, 2-3 hours for Android

## ⚠️ Common Rejection Reasons & Solutions

### iOS App Store
1. **Location Permission**: Provide clear, detailed explanation
2. **Background Usage**: Justify background location necessity
3. **Placeholder Content**: Ensure all content is finalized
4. **Performance Issues**: Test on older devices (iPhone 8+)

### Google Play Store
1. **Target API**: Must target latest API level
2. **Permission Usage**: Remove unused permissions
3. **Content Policy**: Ensure compliance with content policies
4. **Technical Issues**: Test on various Android versions

## 📞 Support & Resources

- **Expo Documentation**: https://docs.expo.dev/
- **EAS Build Guide**: https://docs.expo.dev/build/introduction/
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Play Store Policies**: https://developer.android.com/distribute/google-play/policies
- **LiveMetro Support**: support@livemetro.app

---

**Deployment Prepared**: T-009 Complete ✅  
**Next Step**: Execute builds and submit to stores  
**Estimated Review Time**: iOS (24-48 hours), Android (2-3 hours)