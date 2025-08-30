# LiveMetro - 실시간 전철 알림 앱

Real-time subway notification application for Seoul metropolitan area commuters.

## 📱 Project Overview

LiveMetro provides real-time train arrival and delay information, emergency alerts, and alternative route suggestions to help Seoul subway users optimize their commute time and reduce uncertainty.

### Key Features (v1.0)

- 🚇 **Real-time train arrivals** with delay notifications  
- 🚨 **Emergency alerts** for service disruptions
- 🗺️ **Alternative route suggestions** when delays occur
- ⭐ **Favorite stations** management
- 🔔 **Customizable notifications** with time-based settings
- 📊 **Congestion data** (Premium feature)
- 📱 **Widgets & Watch complications**

## 🛠 Technology Stack

- **Platform**: React Native with Expo
- **Language**: TypeScript 
- **Backend**: Firebase (Firestore, Auth, Cloud Functions, ML)
- **Styling**: TailwindCSS / Styled-components
- **State Management**: Redux / Context API
- **CI/CD**: GitHub Actions
- **Storage**: AWS S3 (asset backup)

## 🏗 Architecture

Domain-driven design with layered architecture:

```
src/
├── components/          # UI components by domain
├── screens/            # Application screens
├── services/           # API clients & business logic  
├── models/             # TypeScript type definitions
├── utils/              # Utility functions
└── hooks/              # Custom React hooks
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- Firebase project setup
- Seoul Open API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd liveMetro

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm start
```

### Development Commands

```bash
npm start          # Start Expo development server
npm run android    # Run on Android device/emulator
npm run ios        # Run on iOS device/simulator  
npm run web        # Run web version
npm run lint       # Run ESLint
npm run type-check # TypeScript type checking
npm test           # Run tests
```

## 📋 Development Status

### ✅ T-001: Foundation Setup (Current)

- [x] React Native project initialization with TypeScript
- [x] ESLint, Prettier, and development tooling configuration
- [x] Domain-driven folder structure creation
- [x] Core TypeScript models and interfaces
- [x] Environment configuration setup
- [x] Basic app structure and placeholder screens

### 📝 Next Tasks (T-002+)

- [ ] Firebase configuration and authentication setup
- [ ] Navigation structure implementation
- [ ] Core UI components development
- [ ] Real-time data service integration
- [ ] Notification system implementation
- [ ] Testing framework setup

## 📊 Success Metrics

- **User Engagement**: MAU/DAU tracking
- **Notification Accuracy**: ≥ 95% delay alert accuracy
- **User Retention**: < 5% app deletion rate (30 days)
- **Usage Time**: ≥ 2 minutes average daily usage
- **Performance**: < 3s load time on 3G networks

## 🚀 Deployment Strategy

- **Phase 1**: MVP with core features (8 weeks)
- **Phase 2**: Advanced features + premium subscription (12 weeks)
- **v1.0**: Seoul metropolitan area coverage
- **v2.0**: Expansion to regional railways and GTX

## 🤝 Contributing

This project follows clean code principles and vooster-ai development guidelines. Please refer to:

- `vooster-docs/guideline.md` for coding standards
- `vooster-docs/clean-code.md` for code quality guidelines  
- `vooster-docs/step-by-step.md` for development methodology

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- [Product Requirements](vooster-docs/prd.md)
- [Technical Architecture](vooster-docs/architecture.md)
- [Development Guidelines](vooster-docs/guideline.md)