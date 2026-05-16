/**
 * K-Shortest Path Algorithm (Yen's Algorithm)
 * Finds k shortest paths between two stations
 */

import { PriorityQueue } from '@/utils/priorityQueue';
import { STATIONS, LINE_STATIONS } from '@utils/subwayMapData';
import {
  Route,
  RouteSegment,
  createRoute,
  getLineName,
  AVG_STATION_TRAVEL_TIME,
  getEdgeMinutes,
} from '@models/route';
import { getTransferTime } from './transferTime';

// Branch-line shuttle wait (same-line sub-line transfer, e.g. 신정지선↔본선 at
// 신도림). Shuttle services are physically separate operations even when
// share the same line id, so a `transferCount += 1` semantically represents
// the user changing trains. Wait time is shorter than cross-line transfer
// (`AVG_TRANSFER_TIME=4min`) because the platforms are typically adjacent.
const AVG_BRANCH_SHUTTLE_WAIT = 3;

/**
 * For a station that appears in multiple subarrays of the same line,
 * the graph nodes are kept distinct via the `::${subIdx}` suffix so that
 * `transferCount` can correctly account for the branch-main shuttle change.
 * Use this helper to derive the trunk lineId for UI display where the
 * subIdx distinction is internal and must not leak to LINE_LABELS lookup.
 */
export function trunkLineId(lineIdWithSub: string): string {
  return lineIdWithSub.split('::')[0] ?? lineIdWithSub;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Path result from k-shortest paths
 */
export interface KShortestPathResult {
  readonly paths: readonly Route[];
  readonly k: number;
  readonly fromStationId: string;
  readonly toStationId: string;
  readonly executionTimeMs: number;
}

/**
 * Internal path representation
 */
interface InternalPath {
  nodes: string[];
  cost: number;
}

/**
 * Graph edge
 */
interface Edge {
  to: string;
  weight: number;
  isTransfer: boolean;
  lineId: string;
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build adjacency list graph
 */
function buildGraph(
  excludeNodeKeys?: Set<string>,
  excludeEdges?: Set<string>,
  congestionMultipliers?: ReadonlyMap<string, number>,
): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>();

  // Phase A: inline congestion-multiplier helper. Applied at edge-creation
  // time so the hot inner loop of Yen's algorithm doesn't pay an extra
  // O(V+E) post-pass + per-edge object allocation on every spur call.
  const adjustWeight = (baseWeight: number, lineId: string): number =>
    baseWeight * (congestionMultipliers?.get(lineId) ?? 1.0);

  // Add edges for each line. Branched lines (`string[][]` schema) have N
  // subarrays — each subarray gets its own node-key namespace via the
  // `::${subIdx}` suffix so that branch and trunk subarrays do NOT share a
  // node. This is critical for sub-line transfer semantics: shuttle services
  // (e.g. 2호선 신정지선 까치산↔신도림) are operationally separate from the
  // trunk loop, and the graph must reflect that a user changes trains at
  // the branch junction. See `addBranchJunctionTransferEdges` below.
  //
  // Adjacent edges within a single subarray use `isTransfer=false` and the
  // raw lineId. Edge.lineId carrying the `::subIdx` suffix is required for
  // `isTransfer` detection in segment build (`routeService.ts:415`) where
  // `currentLineId !== nextLineId` flags transfers. UI consumers strip the
  // suffix via `trunkLineId()` for LINE_LABELS lookup.
  Object.entries(LINE_STATIONS).forEach(([lineId, segments]) => {
    segments.forEach((stationIds, subIdx) => {
      const subLineId = `${lineId}::${subIdx}`;
      for (let i = 0; i < stationIds.length; i++) {
        const stationId = stationIds[i];
        if (!stationId) continue;

        const nodeKey = `${stationId}#${subLineId}`;
        if (excludeNodeKeys?.has(nodeKey)) continue;

        if (!graph.has(nodeKey)) {
          graph.set(nodeKey, []);
        }

        // Add edge to next station
        if (i < stationIds.length - 1) {
          const nextStationId = stationIds[i + 1];
          if (nextStationId) {
            const nextKey = `${nextStationId}#${subLineId}`;
            if (!excludeNodeKeys?.has(nextKey)) {
              const edgeKey = `${nodeKey}->${nextKey}`;
              if (!excludeEdges?.has(edgeKey)) {
                graph.get(nodeKey)?.push({
                  to: nextKey,
                  weight: adjustWeight(getEdgeMinutes(stationId, nextStationId, lineId), lineId),
                  isTransfer: false,
                  lineId: subLineId,
                });
              }
            }
          }
        }

        // Add edge to previous station
        if (i > 0) {
          const prevStationId = stationIds[i - 1];
          if (prevStationId) {
            const prevKey = `${prevStationId}#${subLineId}`;
            if (!excludeNodeKeys?.has(prevKey)) {
              const edgeKey = `${nodeKey}->${prevKey}`;
              if (!excludeEdges?.has(edgeKey)) {
                graph.get(nodeKey)?.push({
                  to: prevKey,
                  weight: adjustWeight(getEdgeMinutes(stationId, prevStationId, lineId), lineId),
                  isTransfer: false,
                  lineId: subLineId,
                });
              }
            }
          }
        }
      }
    });
  });

  // Branch junction transfer edges: when the same station appears in
  // multiple subarrays of the same line (e.g. 신도림 in line 2's 본선[0]
  // and 신정지선[2]), add a transfer edge between the sub-line nodes with
  // `AVG_BRANCH_SHUTTLE_WAIT` weight. This is the algorithm-layer fix that
  // RED tests in `branchTransferSemantics.integration.test.ts` exercise.
  Object.entries(LINE_STATIONS).forEach(([lineId, segments]) => {
    const stationToSubs = new Map<string, number[]>();
    segments.forEach((stationIds, subIdx) => {
      stationIds.forEach(stationId => {
        if (!stationId) return;
        const list = stationToSubs.get(stationId) ?? [];
        if (!list.includes(subIdx)) list.push(subIdx);
        stationToSubs.set(stationId, list);
      });
    });

    stationToSubs.forEach((subs, stationId) => {
      if (subs.length < 2) return;
      for (let i = 0; i < subs.length; i++) {
        for (let j = i + 1; j < subs.length; j++) {
          const subLineA = `${lineId}::${subs[i]}`;
          const subLineB = `${lineId}::${subs[j]}`;
          const keyA = `${stationId}#${subLineA}`;
          const keyB = `${stationId}#${subLineB}`;
          if (excludeNodeKeys?.has(keyA) || excludeNodeKeys?.has(keyB)) continue;

          if (graph.has(keyA) && !excludeEdges?.has(`${keyA}->${keyB}`)) {
            graph.get(keyA)?.push({
              to: keyB,
              weight: adjustWeight(AVG_BRANCH_SHUTTLE_WAIT, lineId),
              isTransfer: true,
              lineId: subLineB,
            });
          }
          if (graph.has(keyB) && !excludeEdges?.has(`${keyB}->${keyA}`)) {
            graph.get(keyB)?.push({
              to: keyA,
              weight: adjustWeight(AVG_BRANCH_SHUTTLE_WAIT, lineId),
              isTransfer: true,
              lineId: subLineA,
            });
          }
        }
      }
    });
  });

  // Handle circular line 2 — only on trunk subarray (segments[0]).
  // Branch subarrays (성수지선, 신정지선) are linear, not circular.
  //
  // Key format unified to `${stationId}#${lineId}::${subIdx}` (trunk=`::0`).
  // Previous format `${first}_2` (underscore) was a doc-rot artifact from
  // before the `_`→`#` rename and made this block a silent no-op. Fixed
  // here as Sub-PR #2 follow-up: the ring closing edge (시청↔충정로) is
  // now actually added so 2호선 순환선이 그래프상 닫힘.
  const line2Trunk = LINE_STATIONS['2']?.[0];
  if (line2Trunk && line2Trunk.length > 1) {
    const first = line2Trunk[0];
    const last = line2Trunk[line2Trunk.length - 1];
    if (first && last) {
      const trunkSubLineId = '2::0';
      const firstKey = `${first}#${trunkSubLineId}`;
      const lastKey = `${last}#${trunkSubLineId}`;

      if (!excludeNodeKeys?.has(firstKey) && !excludeNodeKeys?.has(lastKey)) {
        if (!excludeEdges?.has(`${lastKey}->${firstKey}`)) {
          graph.get(lastKey)?.push({
            to: firstKey,
            weight: adjustWeight(getEdgeMinutes(last, first, '2'), '2'),
            isTransfer: false,
            lineId: trunkSubLineId,
          });
        }
        if (!excludeEdges?.has(`${firstKey}->${lastKey}`)) {
          graph.get(firstKey)?.push({
            to: lastKey,
            weight: adjustWeight(getEdgeMinutes(first, last, '2'), '2'),
            isTransfer: false,
            lineId: trunkSubLineId,
          });
        }
      }
    }
  }

  // Cross-line transfer edges. When a station appears in multiple lines
  // (e.g. 신도림 in line 1 and line 2), add transfer edges. After sub-line
  // encoding, the same station may have multiple sub-line nodes per line
  // (line 2 has 신도림#2::0 trunk and 신도림#2::2 sinjeong branch). The
  // transfer edge is added between every sub-line pair across lines so
  // that a passenger can change between any combination — domain model
  // is that the cross-line transfer corridor is shared (Option B).
  //
  // Pre-calculate a station-to-subIdxs index per line for O(1) lookup
  // (otherwise this would be O(Stations * Lines²) with redundant array
  // scanning per cross-line pair).
  const stationSubIdxIndex = new Map<string, Map<string, number[]>>();
  Object.entries(LINE_STATIONS).forEach(([lineId, segments]) => {
    const inner = new Map<string, number[]>();
    segments.forEach((stationIds, subIdx) => {
      stationIds.forEach(sid => {
        if (!sid) return;
        const list = inner.get(sid);
        if (list) {
          if (!list.includes(subIdx)) list.push(subIdx);
        } else {
          inner.set(sid, [subIdx]);
        }
      });
    });
    stationSubIdxIndex.set(lineId, inner);
  });
  const subIdxsOfStationInLine = (stationId: string, lineId: string): number[] =>
    stationSubIdxIndex.get(lineId)?.get(stationId) ?? [];

  Object.values(STATIONS).forEach(station => {
    const stationLines = station.lines.filter(
      lineId => (LINE_STATIONS[lineId]?.length ?? 0) > 0
    );

    for (let i = 0; i < stationLines.length; i++) {
      for (let j = i + 1; j < stationLines.length; j++) {
        const line1 = stationLines[i];
        const line2 = stationLines[j];
        if (!line1 || !line2) continue;

        const subs1 = subIdxsOfStationInLine(station.id, line1);
        const subs2 = subIdxsOfStationInLine(station.id, line2);

        subs1.forEach(sub1 => {
          subs2.forEach(sub2 => {
            const subLine1 = `${line1}::${sub1}`;
            const subLine2 = `${line2}::${sub2}`;
            const key1 = `${station.id}#${subLine1}`;
            const key2 = `${station.id}#${subLine2}`;
            if (excludeNodeKeys?.has(key1) || excludeNodeKeys?.has(key2)) return;

            if (graph.has(key1) && !excludeEdges?.has(`${key1}->${key2}`)) {
              graph.get(key1)?.push({
                to: key2,
                weight: adjustWeight(getTransferTime(station.id), line2),
                isTransfer: true,
                lineId: subLine2,
              });
            }

            if (graph.has(key2) && !excludeEdges?.has(`${key2}->${key1}`)) {
              graph.get(key2)?.push({
                to: key1,
                weight: adjustWeight(getTransferTime(station.id), line1),
                isTransfer: true,
                lineId: subLine1,
              });
            }
          });
        });
      }
    }
  });


  return graph;
}

/**
 * Get all node keys for a station — enumerates every subarray (sub-line)
 * the station belongs to. A station appearing in trunk + branch (e.g. 신도림
 * in line 2's 본선[0] and 신정지선[2]) yields multiple keys, so multi-source
 * Dijkstra explores from all entry points.
 */
function getStationNodeKeys(stationId: string): string[] {
  const station = STATIONS[stationId];
  if (!station) return [];

  const keys: string[] = [];
  station.lines.forEach(lineId => {
    const segs = LINE_STATIONS[lineId];
    if (!segs || segs.length === 0) return;
    segs.forEach((sub, subIdx) => {
      if (sub.includes(stationId)) {
        keys.push(`${stationId}#${lineId}::${subIdx}`);
      }
    });
  });
  return keys;
}

// ============================================================================
// Dijkstra's Algorithm
// ============================================================================

/**
 * Find shortest path using Dijkstra
 */
function dijkstra(
  graph: Map<string, Edge[]>,
  startKeys: string[],
  endKeys: string[]
): InternalPath | null {
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const queue = new PriorityQueue<string>();

  // Initialize
  graph.forEach((_, key) => {
    distances.set(key, Infinity);
  });

  for (const startKey of startKeys) {
    if (graph.has(startKey)) {
      distances.set(startKey, 0);
      queue.enqueue(startKey, 0);
    }
  }

  const visited = new Set<string>();

  while (!queue.isEmpty()) {
    const current = queue.dequeue();
    if (!current) break;

    if (visited.has(current)) continue;
    visited.add(current);

    // Check if we reached destination
    if (endKeys.includes(current)) {
      const path: string[] = [];
      let node: string | undefined = current;
      while (node) {
        path.unshift(node);
        node = previous.get(node);
      }
      return {
        nodes: path,
        cost: distances.get(current) ?? Infinity,
      };
    }

    const edges = graph.get(current) ?? [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;

      const currentDist = distances.get(current) ?? Infinity;
      const newDist = currentDist + edge.weight;
      const existingDist = distances.get(edge.to) ?? Infinity;

      if (newDist < existingDist) {
        distances.set(edge.to, newDist);
        previous.set(edge.to, current);
        queue.enqueue(edge.to, newDist);
      }
    }
  }

  return null;
}

// ============================================================================
// Yen's K-Shortest Paths Algorithm
// ============================================================================

/**
 * Find k shortest paths using Yen's algorithm
 */
export function findKShortestPaths(
  fromStationId: string,
  toStationId: string,
  k: number = 3,
  congestionMultipliers?: ReadonlyMap<string, number>,
): KShortestPathResult {
  const startTime = Date.now();

  const startKeys = getStationNodeKeys(fromStationId);
  const endKeys = getStationNodeKeys(toStationId);

  if (startKeys.length === 0 || endKeys.length === 0) {
    return {
      paths: [],
      k,
      fromStationId,
      toStationId,
      executionTimeMs: Date.now() - startTime,
    };
  }

  const A: InternalPath[] = []; // k shortest paths
  const B = new PriorityQueue<InternalPath>(); // Candidate paths

  // Find the first shortest path
  const graph = buildGraph(undefined, undefined, congestionMultipliers);
  const firstPath = dijkstra(graph, startKeys, endKeys);

  if (!firstPath) {
    return {
      paths: [],
      k,
      fromStationId,
      toStationId,
      executionTimeMs: Date.now() - startTime,
    };
  }

  A.push(firstPath);

  // Track transfer signatures of accepted paths. Each K slot in A must
  // correspond to a topologically distinct transfer set — otherwise
  // signature-duplicate variants (same transfer stations, slightly different
  // segment timing) consume K slots and squeeze out distinct routes.
  //
  // Background (memory [pr79-pending-followups] Priority 1):
  //   PR #79 gyeongui 4-subarray reshape shifted Yen's exploration order
  //   such that 산곡→선릉 via 강남구청 (a topologically distinct path)
  //   landed past K=30. Empirical K=40/50/60 all RED — signature-duplicate
  //   variants of nearer routes (e.g. `석남,검암,공덕,용산,청량리` repeated
  //   with minor variations) filled K slots before distinct paths could
  //   enter. Fix: signature-dedupe IN Yen's main loop (this block), not
  //   post-hoc in getDiverseRoutes groupMap.
  const acceptedSignatures = new Set<string>();
  acceptedSignatures.add(buildNodePathSignature(firstPath.nodes));

  // Find k-1 more paths
  for (let i = 1; i < k; i++) {
    const prevPath = A[i - 1];
    if (!prevPath) break;

    // Spur node iteration
    for (let j = 0; j < prevPath.nodes.length - 1; j++) {
      const spurNode = prevPath.nodes[j];
      if (!spurNode) continue;

      const rootPath = prevPath.nodes.slice(0, j + 1);

      // Remove edges that are part of previous paths with same root
      const excludeEdges = new Set<string>();
      for (const path of A) {
        if (path.nodes.length > j) {
          const pathRoot = path.nodes.slice(0, j + 1);
          if (pathRoot.join(',') === rootPath.join(',')) {
            const fromNode = path.nodes[j];
            const toNode = path.nodes[j + 1];
            if (fromNode && toNode) {
              excludeEdges.add(`${fromNode}->${toNode}`);
            }
          }
        }
      }

      // Exclude root path nodes (except spur node)
      const excludeNodes = new Set<string>(rootPath.slice(0, -1));

      // Find spur path
      const spurGraph = buildGraph(excludeNodes, excludeEdges, congestionMultipliers);
      const spurPath = dijkstra(spurGraph, [spurNode], endKeys);

      if (spurPath && spurPath.nodes.length > 1) {
        // Combine root path and spur path
        const totalPath: InternalPath = {
          nodes: [...rootPath.slice(0, -1), ...spurPath.nodes],
          cost: calculatePathCost(rootPath.slice(0, -1)) + spurPath.cost,
        };

        // Add to candidates if not already in A or B
        const pathKey = totalPath.nodes.join(',');
        const existsInA = A.some(p => p.nodes.join(',') === pathKey);

        if (!existsInA) {
          B.enqueue(totalPath, totalPath.cost);
        }
      }
    }

    // Pick the lowest-cost candidate whose transfer signature is NEW (not
    // already represented in A). Skip signature-duplicates. This is the
    // in-loop dedupe described above.
    let nextPath: InternalPath | undefined;
    while (!B.isEmpty()) {
      const candidate = B.dequeue();
      if (!candidate) break;
      const sig = buildNodePathSignature(candidate.nodes);
      if (acceptedSignatures.has(sig)) {
        continue; // signature-duplicate variant — skip
      }
      acceptedSignatures.add(sig);
      nextPath = candidate;
      break;
    }

    if (!nextPath) break; // B exhausted (or all remaining are signature-duplicates)

    // Remove exact-path duplicates from B (existing optimization, still valid).
    const pathKey = nextPath.nodes.join(',');
    while (!B.isEmpty()) {
      const candidate = B.peek();
      if (candidate && candidate.nodes.join(',') === pathKey) {
        B.dequeue();
      } else {
        break;
      }
    }

    A.push(nextPath);
  }

  // Convert internal paths to Route objects
  const routes = A.map(internalPath => convertToRoute(internalPath));

  return {
    paths: routes,
    k,
    fromStationId,
    toStationId,
    executionTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate path cost
 */
function calculatePathCost(nodes: string[]): number {
  let cost = 0;

  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    if (!current || !next) continue;

    const [currentStationId, currentLineId] = current.split('#');
    const [nextStationId, nextLineId] = next.split('#');

    if (currentStationId === nextStationId && currentLineId !== nextLineId && currentStationId) {
      cost += getTransferTime(currentStationId);
    } else if (currentStationId && nextStationId && nextLineId) {
      cost += getEdgeMinutes(currentStationId, nextStationId, nextLineId);
    } else {
      cost += AVG_STATION_TRAVEL_TIME;
    }
  }

  return cost;
}

/**
 * Convert internal path to Route
 */
function convertToRoute(internalPath: InternalPath): Route {
  const segments: RouteSegment[] = [];

  for (let i = 0; i < internalPath.nodes.length - 1; i++) {
    const currentKey = internalPath.nodes[i];
    const nextKey = internalPath.nodes[i + 1];
    if (!currentKey || !nextKey) continue;

    const [currentStationId, currentLineId] = currentKey.split('#');
    const [nextStationId, nextLineId] = nextKey.split('#');
    if (!currentStationId || !currentLineId || !nextStationId || !nextLineId) continue;

    const currentStation = STATIONS[currentStationId];
    const nextStation = STATIONS[nextStationId];
    if (!currentStation || !nextStation) continue;

    // isTransfer detection needs the `::subIdx` suffix intact — a branch
    // shuttle (e.g. `gyeongchun::1` → `gyeongchun::0` at 상봉) differs only
    // in subIdx. But the segment's public `lineId`/`lineName` must carry the
    // trunk id only; the suffix is an internal graph-encoding detail and
    // leaks into Route.lineIds / LINE_LABELS lookup if not stripped here.
    const isTransfer = currentStationId === nextStationId && currentLineId !== nextLineId;
    const segmentLineId = trunkLineId(isTransfer ? nextLineId : currentLineId);

    segments.push({
      fromStationId: currentStationId,
      fromStationName: currentStation.name,
      toStationId: nextStationId,
      toStationName: nextStation.name,
      lineId: segmentLineId,
      lineName: getLineName(segmentLineId),
      estimatedMinutes: isTransfer
        ? getTransferTime(currentStationId)
        : getEdgeMinutes(currentStationId, nextStationId, segmentLineId),
      isTransfer,
    });
  }

  return createRoute(segments);
}

/**
 * Compute transfer signature from a raw node path (faster than building a
 * full Route first). Used by Yen's K-shortest in-loop dedupe — each K slot
 * in A must correspond to a topologically distinct transfer signature.
 *
 * Node format: `${stationId}#${lineId}`. A transfer occurs when consecutive
 * nodes share `stationId` but differ in `lineId`.
 *
 * Returns the same format as `buildTransferSignature`: '|'-joined sorted
 * station NAMEs (not IDs). Names are used so the signature aligns 1:1 with
 * `buildTransferSignature(route)` later — a route's node-path signature
 * and its converted Route signature must be identical strings.
 */
function buildNodePathSignature(nodes: string[]): string {
  const transfers = new Set<string>();
  for (let i = 0; i < nodes.length - 1; i++) {
    const cur = nodes[i];
    const next = nodes[i + 1];
    if (!cur || !next) continue;
    const [stationA, lineA] = cur.split('#');
    const [stationB, lineB] = next.split('#');
    if (
      stationA &&
      stationB &&
      lineA &&
      lineB &&
      stationA === stationB &&
      lineA !== lineB
    ) {
      const name = STATIONS[stationA]?.name;
      if (name) transfers.add(name);
    }
  }
  return [...transfers].sort().join('|');
}

/**
 * Build a stable signature representing the *set of transfer stations* a
 * route visits. Used by `getDiverseRoutes` to cluster K-shortest candidates
 * by transfer-station identity — routes sharing the same transfer set are
 * variants of the same idea and collapse into one card.
 *
 * Signature rules:
 *  - Direct routes (no transfer) → '' (empty string)
 *  - Single transfer at 강남구청 → '강남구청'
 *  - Two transfers in any order → '강남구청|부평구청' (alphabetical sort)
 *
 * Station NAME is used (not ID) because the resulting signature also drives
 * the user-facing 'via-station' label. ID-based signature would require a
 * second lookup at label time.
 */
export function buildTransferSignature(route: Route): string {
  const names = route.segments
    .filter((s) => s.isTransfer)
    .map((s) => s.fromStationName)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .sort();
  return names.join('|');
}

/**
 * Hard cap on transfers for any suggested route. Empirically routes in
 * 수도권 cover all reasonable origin-destination pairs with ≤2 transfers;
 * 3+ transfers almost always indicate a detour the user would not pick.
 */
const MAX_ROUTE_TRANSFERS = 2;

/**
 * Default and max number of cards exposed by `getDiverseRoutes`. Adaptive —
 * fewer than this is fine when diversity is limited (e.g. only 1 signature
 * group exists, or short OD pairs).
 */
const DEFAULT_MAX_ROUTES = 5;

/**
 * Routes whose totalMinutes exceed `fastest.totalMinutes * UNREALISTIC_TIME_FACTOR`
 * are filtered out — they're typically valid graph paths but not realistic
 * commute options.
 */
const UNREALISTIC_TIME_FACTOR = 1.5;

/**
 * Number of K-shortest candidates explored before signature grouping. Higher
 * values surface topologically distinct transfer paths that Yen's algorithm
 * does not reach with small K. Each increment roughly doubles the per-query
 * cost. Increase only if user reports a specific missing alternative (and
 * document the OD pair).
 *
 * History:
 *   - PR #58: 10 → 15 (initial transfer-grouping diversity)
 *   - PR #68: 15 → 30 (산곡→선릉 강남구청 경유 — pre-signature-dedupe;
 *     duplicate-signature variants consumed K slots, so K=30 was needed
 *     to surface the ~#25-ranked 강남구청 alternative)
 *   - PR #91: in-loop signature-dedupe added in `findKShortestPaths` (each
 *     K slot now corresponds to a distinct transfer signature, not just a
 *     distinct node path). With dedupe, K-slots are far more diverse — the
 *     same 강남구청 alternative now appears within the top-11 unique
 *     signatures (verified empirically: K=10 fails, K=11 passes).
 *   - PR ?? (this): 30 → 15. Empirical experiment: 산곡→선릉 integration
 *     test passes from K=11 onward post-dedupe (vs K=25+ pre-dedupe).
 *     15 chosen for 4-slot safety margin above the empirical floor; halves
 *     per-query cost relative to K=30 (~57% test-suite speedup measured:
 *     17.3s → 7.5s median on kShortestPath.integration.test). Raise back
 *     toward 30 only if a missing-alternative regression appears.
 */
const K_SHORTEST_CANDIDATES = 15;

/**
 * Pick a diverse set of 1–5 routes from the K-shortest candidates by
 * grouping on transfer-station signature. Returns up to `maxRoutes` cards
 * with the following category invariants:
 *
 *  - First card: `category: 'fastest'` (minimum totalMinutes overall)
 *  - Optional second card: `category: 'min-transfer'` ONLY when
 *    `minTransfer.transferCount < fastest.transferCount` (PR #55 invariant).
 *  - Remaining cards: `category: 'via-station'` with `viaTags: ['{역} 경유']`
 *    sorted by totalMinutes ascending.
 *
 * `via-station` label uses the *last* transfer station along the route
 * (closest to destination) because that's the more memorable hop for users
 * planning the trip.
 *
 * Routes with > MAX_ROUTE_TRANSFERS transfers are filtered out unless no
 * candidate qualifies (in which case we fall back to the K-shortest #1 so
 * the UI shows something).
 */
export function getDiverseRoutes(
  fromStationId: string,
  toStationId: string,
  maxRoutes: number = DEFAULT_MAX_ROUTES,
  congestionMultipliers?: ReadonlyMap<string, number>,
): Route[] {
  const result = findKShortestPaths(
    fromStationId,
    toStationId,
    K_SHORTEST_CANDIDATES,
    congestionMultipliers,
  );
  if (result.paths.length === 0) return [];

  const filtered = result.paths.filter((r) => r.transferCount <= MAX_ROUTE_TRANSFERS);
  const candidates = filtered.length > 0 ? filtered : [result.paths[0]!];

  // 1. Group by transfer signature, keep cost-min representative per group
  const groupMap = new Map<string, Route>();
  for (const c of candidates) {
    const sig = buildTransferSignature(c);
    const prev = groupMap.get(sig);
    if (!prev || c.totalMinutes < prev.totalMinutes) {
      groupMap.set(sig, c);
    }
  }
  const representatives = [...groupMap.values()].sort(
    (a, b) => a.totalMinutes - b.totalMinutes,
  );

  // 2. Identify fastest (already first after sort)
  const fastest = representatives[0]!;

  // 3. Apply 1.5x time-gap cap relative to fastest
  const timeThreshold = fastest.totalMinutes * UNREALISTIC_TIME_FACTOR;
  const reachableReps = representatives.filter(
    (r) => r.totalMinutes <= timeThreshold,
  );

  // 4. Identify min-transfer ONLY if strictly better than fastest
  // (PR #55 invariant — preserved). Pick from reachable, not fastest itself.
  const minTransfer = reachableReps.reduce<Route | null>((best, r) => {
    if (r === fastest) return best;
    if (r.transferCount >= fastest.transferCount) return best;
    if (!best) return r;
    if (r.transferCount < best.transferCount) return r;
    if (r.transferCount === best.transferCount && r.totalMinutes < best.totalMinutes) {
      return r;
    }
    return best;
  }, null);

  // 5. Adaptive selection up to maxRoutes
  const selected: Route[] = [labelFastest(fastest)];
  if (minTransfer) {
    selected.push(labelMinTransfer(minTransfer));
  }

  const remaining = reachableReps.filter(
    (r) => r !== fastest && r !== minTransfer,
  );
  for (const r of remaining) {
    if (selected.length >= maxRoutes) break;
    selected.push(labelViaStation(r));
  }

  return selected;
}

function labelFastest(route: Route): Route {
  return { ...route, category: 'fastest' };
}

function labelMinTransfer(route: Route): Route {
  return { ...route, category: 'min-transfer' };
}

/**
 * Label a route as 'via-station' using the last transfer station along
 * the route as the user-facing tag. Empty viaTags would be a contract
 * violation — we fall back to '환승 경유' (generic) if the route has no
 * transfers (which shouldn't reach this path, but defensive).
 */
function labelViaStation(route: Route): Route {
  const transfers = route.segments
    .filter((s) => s.isTransfer)
    .map((s) => s.fromStationName);
  const lastTransfer = transfers[transfers.length - 1];
  const tag = lastTransfer ? `${lastTransfer} 경유` : '환승 경유';
  return {
    ...route,
    category: 'via-station',
    viaTags: [tag],
  };
}

export default { findKShortestPaths, getDiverseRoutes };
