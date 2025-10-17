# Technology Stack & Build System

## Core Technologies

- **Platform**: React Native with Expo SDK 49
- **Language**: TypeScript with strict type checking
- **Backend**: Firebase (Firestore, Auth, Cloud Functions, ML)
- **State Management**: React Context API / Redux
- **Navigation**: React Navigation v6
- **Styling**: React Native StyleSheet (considering TailwindCSS/Styled-components)
- **Testing**: Jest with React Native Testing Library
- **CI/CD**: GitHub Actions with EAS Build

## Development Tools

- **Package Manager**: npm
- **Code Quality**: ESLint + Prettier
- **Type Checking**: TypeScript with strict configuration
- **Build System**: Expo Application Services (EAS)
- **Deployment**: EAS Build & Submit

## Common Commands

```bash
# Development
npm start              # Start Expo development server
npm run android        # Run on Android device/emulator
npm run ios           # Run on iOS device/simulator
npm run web           # Run web version

# Code Quality
npm run lint          # Run ESLint with auto-fix
npm run type-check    # TypeScript type checking
npm run prebuild      # Lint + type-check before build

# Testing
npm test              # Run Jest tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Building & Deployment
npm run build:development  # EAS development build
npm run build:preview     # EAS preview build
npm run build:production  # EAS production build
npm run submit:ios        # Submit to App Store
npm run submit:android    # Submit to Play Store
```

## Key Dependencies

- **UI/Navigation**: @react-navigation/native, @react-navigation/stack, @react-navigation/bottom-tabs
- **State**: @react-native-async-storage/async-storage
- **Location**: expo-location
- **Notifications**: expo-notifications
- **Firebase**: firebase v10.7.1
- **Icons**: @expo/vector-icons

## Path Aliases

The project uses TypeScript path mapping for cleaner imports:

```typescript
"@/*": ["src/*"]
"@components/*": ["src/components/*"]
"@screens/*": ["src/screens/*"]
"@services/*": ["src/services/*"]
"@models/*": ["src/models/*"]
"@utils/*": ["src/utils/*"]
"@hooks/*": ["src/hooks/*"]
```

## Environment Configuration

- Development environment uses `.env` file (already configured)
- Production uses EAS environment variables
- Firebase configuration managed through `src/services/firebase/config.ts`