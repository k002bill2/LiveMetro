/**
 * Route Services Module
 * Route calculation, fare estimation, and alternative paths
 */

// Main route service
export * from './routeService';

// Fare calculation
export {
  fareService,
  type FareResult,
  type FareType,
  type FareBreakdown,
  type RouteFareInfo,
} from './fareService';

// K-shortest paths
export {
  findKShortestPaths,
  getDiverseRoutes,
  type KShortestPathResult,
} from './kShortestPath';
