# Testing Guide

## Test Configuration

| Setting | Value |
|---------|-------|
| **Test Runner** | Jest with React Native preset |
| **Test Environment** | Node (not jsdom) |
| **Coverage Thresholds** | 75% statements/lines, 70% functions, 60% branches |
| **Setup File** | `src/__tests__/setup.ts` (loads before all tests) |

## Running Tests

```bash
# Run all tests
npm test

# Run single test file
npm test -- src/components/train/__tests__/TrainArrivalCard.test.tsx

# Run tests matching pattern
npm test -- --testPathPattern=train

# Run tests in watch mode
npm test:watch

# Generate coverage report
npm test:coverage

# Run Claude Code hook tests (node:test runner, outside Jest)
npm run test:hooks
```

## Test File Organization

Tests are co-located with source files in `__tests__` directories:

```
src/components/train/
├── TrainArrivalCard.tsx
└── __tests__/
    └── TrainArrivalCard.test.tsx
```

## Coverage Requirements

| Metric | Threshold |
|--------|-----------|
| Statements | 75% |
| Lines | 75% |
| Functions | 70% |
| Branches | 60% |

Builds will fail if coverage drops below these thresholds.
