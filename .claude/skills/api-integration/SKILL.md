---
name: api-integration
description: Seoul Subway API integration and data management for LiveMetro. Use when working with external APIs or data fetching.
---

# API Integration Guidelines

## Seoul Subway API

### Endpoint Configuration (src/services/api/seoulSubwayApi.ts)

```typescript
const SEOUL_API_BASE_URL = 'http://swopenAPI.seoul.go.kr/api/subway';
const API_KEY = process.env.SEOUL_API_KEY;

/**
 * Fetch real-time train arrival data
 * @param stationName - Korean station name (e.g., "강남")
 * @returns Train arrival information
 */
export const getRealtimeArrivals = async (
  stationName: string
): Promise<Train[]> => {
  try {
    const url = `${SEOUL_API_BASE_URL}/${API_KEY}/json/realtimeStationArrival/0/10/${encodeURIComponent(
      stationName
    )}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.errorMessage) {
      throw new Error(data.errorMessage.message);
    }

    return parseTrainData(data.realtimeArrivalList || []);
  } catch (error) {
    console.error('Seoul API error:', error);
    throw error;
  }
};
```

## 3-Tier Data Architecture

```typescript
/**
 * Tier 1: Seoul API (Real-time data)
 * Tier 2: Firebase Firestore (Cloud backup)
 * Tier 3: AsyncStorage (Local cache)
 */

import { dataManager } from '@services/data/dataManager';

// Automatically tries all tiers
const trains = await dataManager.getRealtimeTrains(stationName);
```

## Error Handling Pattern

```typescript
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Usage
try {
  const data = await fetchAPI();
} catch (error) {
  if (error instanceof APIError) {
    // Handle API-specific error
  }
}
```

## Remember

- ✅ Use 3-tier data fallback system
- ✅ Handle rate limits gracefully
- ✅ Cache responses appropriately
- ✅ Validate API responses
- ✅ Use proper error types

## Additional Resources

- [Seoul Open API Portal](https://data.seoul.go.kr/)
- [DataManager Service](../../src/services/data/dataManager.ts)
