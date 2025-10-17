# Project Structure & Organization

## Architecture Pattern

The project follows a **domain-driven, layered architecture** with feature-based modules:

- **Domain-Driven Design**: Code organized around business domains (trains, users, notifications)
- **Layered Architecture**: Clear separation between UI, business logic, and data access
- **Feature-Based Modules**: Related components, services, and models grouped by feature

## Directory Structure

```
src/
├── components/          # Reusable UI components by domain
│   ├── auth/           # Authentication components
│   ├── common/         # Shared/reusable components
│   ├── train/          # Train-related components
│   ├── map/            # Map components
│   └── notification/   # Notification components
├── screens/            # Application screens/pages
│   ├── auth/           # Login, welcome screens
│   ├── home/           # Main dashboard
│   ├── favorites/      # Saved stations
│   ├── alerts/         # Notifications screen
│   └── settings/       # User preferences
├── services/           # Business logic & API clients
│   ├── api/            # External API integrations
│   ├── auth/           # Authentication logic
│   ├── data/           # Data management
│   ├── firebase/       # Firebase configuration
│   ├── location/       # Location services
│   ├── notification/   # Push notifications
│   ├── train/          # Train data services
│   └── monitoring/     # Performance & crash reporting
├── models/             # TypeScript type definitions
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
└── navigation/         # Navigation configuration
```

## File Naming Conventions

- **Components**: PascalCase (e.g., `TrainCard.tsx`)
- **Screens**: PascalCase with "Screen" suffix (e.g., `HomeScreen.tsx`)
- **Services**: camelCase (e.g., `trainService.ts`)
- **Models**: camelCase (e.g., `train.ts`)
- **Utils**: camelCase (e.g., `dateUtils.ts`)
- **Hooks**: camelCase with "use" prefix (e.g., `useLocation.ts`)

## Component Organization

Each component directory should contain:
- Main component file (`ComponentName.tsx`)
- Test file (`__tests__/ComponentName.test.tsx`)
- Styles (if using styled-components: `ComponentName.styles.ts`)

## Import Conventions

Use path aliases for cleaner imports:

```typescript
// Preferred
import { TrainCard } from '@components/train/TrainCard';
import { useLocation } from '@hooks/useLocation';
import { trainService } from '@services/train/trainService';

// Avoid
import { TrainCard } from '../../../components/train/TrainCard';
```

## Testing Structure

- Unit tests: `__tests__/` directories within each module
- Test setup: `src/__tests__/setup.ts`
- Mocks: `src/__tests__/__mocks__/`
- Coverage threshold: 75% lines, 70% functions, 60% branches

## Configuration Files

- **Root level**: Package management, build configuration
- **src/services/firebase/**: Firebase configuration
- **.kiro/steering/**: AI assistant steering rules
- **vooster-docs/**: Project documentation and guidelines

## State Management

- **Local state**: `useState` for component-level state
- **Global state**: React Context API for simple state, Redux for complex state
- **Data persistence**: AsyncStorage for local data, Firestore for cloud sync