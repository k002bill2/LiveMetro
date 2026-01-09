# TypeScript & ESLint Error Fixes - Tasks

**Last Updated**: 2026-01-10 05:30 KST
**Progress**: 5/9 completed (56%)

## Completed Tasks

- [x] Fix ESLint errors (route/index.ts duplicate export)
- [x] Fix unused variables in test files
- [x] Fix globalThis type declaration
- [x] Fix Example/Demo file props
- [x] Fix Mock data types (StoredNotification, Train)

## In Progress

- [ ] Fix Hook test types
  - useAdjacentStations.test.ts - lineName, unknown type
  - useCommuteSetup.test.ts - possibly undefined

## Pending Tasks

- [ ] Fix E2E test errors
  - BasePage constructor arguments
  - Protected property access

- [ ] Fix ML service types
  - tensorflowSetup.ts
  - trainingService.ts
  - trainArrivalAlertService.ts

- [ ] Fix trainService test mocks
  - SeoulTimetableRow type mismatch

## Verification

- [ ] `npm run type-check` - 0 errors
- [ ] `npm run lint` - 0 errors
- [ ] `npm test` - All pass
