/**
 * Weather Service
 * Fetches and caches weather data for smart notifications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeatherCondition } from '@/models/ml';

// ============================================================================
// Types
// ============================================================================

/**
 * Weather data
 */
export interface WeatherData {
  readonly condition: WeatherCondition;
  readonly temperature: number;
  readonly humidity: number;
  readonly precipitation: number;
  readonly description: string;
  readonly icon: string;
  readonly timestamp: Date;
  readonly location: string;
}

/**
 * Weather forecast item
 */
export interface WeatherForecast {
  readonly date: Date;
  readonly condition: WeatherCondition;
  readonly highTemp: number;
  readonly lowTemp: number;
  readonly precipitation: number;
}

/**
 * Weather impact on commute
 */
export interface WeatherImpact {
  readonly level: 'none' | 'minor' | 'moderate' | 'severe';
  readonly delayProbabilityIncrease: number;
  readonly recommendations: readonly string[];
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:weather_cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Weather code to condition mapping (based on common weather API codes)
const WEATHER_CODE_MAP: Record<number, WeatherCondition> = {
  0: 'clear',    // Clear sky
  1: 'clear',    // Mainly clear
  2: 'clear',    // Partly cloudy
  3: 'other',    // Overcast
  45: 'fog',     // Fog
  48: 'fog',     // Depositing rime fog
  51: 'rain',    // Light drizzle
  53: 'rain',    // Moderate drizzle
  55: 'rain',    // Dense drizzle
  61: 'rain',    // Slight rain
  63: 'rain',    // Moderate rain
  65: 'rain',    // Heavy rain
  71: 'snow',    // Slight snow
  73: 'snow',    // Moderate snow
  75: 'snow',    // Heavy snow
  77: 'snow',    // Snow grains
  80: 'rain',    // Slight rain showers
  81: 'rain',    // Moderate rain showers
  82: 'rain',    // Violent rain showers
  85: 'snow',    // Slight snow showers
  86: 'snow',    // Heavy snow showers
  95: 'other',   // Thunderstorm
  96: 'other',   // Thunderstorm with hail
  99: 'other',   // Thunderstorm with heavy hail
};

// ============================================================================
// Service
// ============================================================================

class WeatherService {
  private cache: {
    data: WeatherData | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0,
  };

  /**
   * Initialize service from cache
   */
  async initialize(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.cache = {
          data: {
            ...parsed.data,
            timestamp: new Date(parsed.data.timestamp),
          },
          timestamp: parsed.timestamp,
        };
      }
    } catch {
      // Ignore cache errors
    }
  }

  /**
   * Get current weather
   * @param location - User's current coordinates (optional)
   */
  async getCurrentWeather(location?: { latitude: number; longitude: number }): Promise<WeatherData | null> {
    // Check cache
    if (this.isCacheValid()) {
      return this.cache.data;
    }

    try {
      const weather = await this.fetchWeather(location);
      if (weather) {
        this.cache = {
          data: weather,
          timestamp: Date.now(),
        };
        await this.saveCache();
      }
      return weather;
    } catch {
      // Return cached data if fetch fails
      return this.cache.data;
    }
  }

  /**
   * Get weather condition
   */
  async getWeatherCondition(): Promise<WeatherCondition> {
    const weather = await this.getCurrentWeather();
    return weather?.condition ?? 'clear';
  }

  /**
   * Get weather impact on commute
   */
  async getWeatherImpact(): Promise<WeatherImpact> {
    const weather = await this.getCurrentWeather();

    if (!weather) {
      return {
        level: 'none',
        delayProbabilityIncrease: 0,
        recommendations: [],
      };
    }

    return this.calculateImpact(weather);
  }

  /**
   * Get weather forecast for next days
   * @param days - Number of forecast days
   * @param location - User's current coordinates (optional)
   */
  async getForecast(
    days: number = 3,
    location?: { latitude: number; longitude: number }
  ): Promise<WeatherForecast[]> {
    if (!location) {
      return [];
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia/Seoul&forecast_days=${days}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Forecast fetch failed');

      const data = await response.json();

      const forecasts: WeatherForecast[] = [];
      const daily = data.daily;

      for (let i = 0; i < daily.time.length; i++) {
        const weatherCode = daily.weather_code[i];
        forecasts.push({
          date: new Date(daily.time[i]),
          condition: WEATHER_CODE_MAP[weatherCode] ?? 'other',
          highTemp: daily.temperature_2m_max[i],
          lowTemp: daily.temperature_2m_min[i],
          precipitation: daily.precipitation_sum[i],
        });
      }

      return forecasts;
    } catch {
      return [];
    }
  }

  /**
   * Check if weather might affect commute
   */
  async shouldAlertForWeather(): Promise<{
    shouldAlert: boolean;
    message?: string;
  }> {
    const impact = await this.getWeatherImpact();

    if (impact.level === 'severe') {
      return {
        shouldAlert: true,
        message: '악천후로 인한 지연이 예상됩니다. 출발 시간을 조정해주세요.',
      };
    }

    if (impact.level === 'moderate') {
      return {
        shouldAlert: true,
        message: '날씨로 인한 약간의 지연이 예상됩니다.',
      };
    }

    return { shouldAlert: false };
  }

  /**
   * Get weather icon name
   */
  getWeatherIcon(condition: WeatherCondition): string {
    const icons: Record<WeatherCondition, string> = {
      clear: 'sun',
      rain: 'cloud-rain',
      snow: 'cloud-snow',
      fog: 'cloud-fog',
      other: 'cloud',
    };
    return icons[condition];
  }

  /**
   * Get weather description in Korean
   */
  getWeatherDescription(condition: WeatherCondition): string {
    const descriptions: Record<WeatherCondition, string> = {
      clear: '맑음',
      rain: '비',
      snow: '눈',
      fog: '안개',
      other: '흐림',
    };
    return descriptions[condition];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Fetch weather from API using provided coordinates
   */
  private async fetchWeather(location?: { latitude: number; longitude: number }): Promise<WeatherData | null> {
    if (!location) {
      return null;
    }

    try {
      // Using Open-Meteo API (free, no API key required)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,precipitation&timezone=Asia/Seoul`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather fetch failed');

      const data = await response.json();
      const current = data.current;

      const weatherCode = current.weather_code;
      const condition = WEATHER_CODE_MAP[weatherCode] ?? 'other';

      return {
        condition,
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        precipitation: current.precipitation,
        description: this.getWeatherDescription(condition),
        icon: this.getWeatherIcon(condition),
        timestamp: new Date(),
        location: '서울',
      };
    } catch (error) {
      console.error('Weather fetch error:', error);
      return null;
    }
  }

  /**
   * Calculate weather impact on commute
   */
  private calculateImpact(weather: WeatherData): WeatherImpact {
    const recommendations: string[] = [];
    let delayIncrease = 0;
    let level: WeatherImpact['level'] = 'none';

    switch (weather.condition) {
      case 'rain':
        if (weather.precipitation > 10) {
          level = 'severe';
          delayIncrease = 0.3;
          recommendations.push('폭우로 인한 지연이 예상됩니다');
          recommendations.push('우산을 꼭 챙기세요');
          recommendations.push('10-15분 일찍 출발하세요');
        } else if (weather.precipitation > 5) {
          level = 'moderate';
          delayIncrease = 0.15;
          recommendations.push('비로 인한 약간의 지연이 예상됩니다');
          recommendations.push('우산을 챙기세요');
        } else {
          level = 'minor';
          delayIncrease = 0.05;
          recommendations.push('가벼운 비가 예상됩니다');
        }
        break;

      case 'snow':
        level = 'severe';
        delayIncrease = 0.4;
        recommendations.push('눈으로 인한 지연이 예상됩니다');
        recommendations.push('미끄럼 주의');
        recommendations.push('20분 이상 일찍 출발하세요');
        break;

      case 'fog':
        level = 'moderate';
        delayIncrease = 0.1;
        recommendations.push('안개로 시야가 좋지 않습니다');
        recommendations.push('지상 교통 혼잡 예상');
        break;

      case 'clear':
      case 'other':
      default:
        level = 'none';
        delayIncrease = 0;
        break;
    }

    // Extreme temperature adjustments
    if (weather.temperature < -10) {
      level = level === 'none' ? 'minor' : level;
      delayIncrease += 0.05;
      recommendations.push('한파 주의');
    } else if (weather.temperature > 35) {
      level = level === 'none' ? 'minor' : level;
      delayIncrease += 0.05;
      recommendations.push('폭염 주의');
    }

    return {
      level,
      delayProbabilityIncrease: delayIncrease,
      recommendations,
    };
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache.data) return false;
    return Date.now() - this.cache.timestamp < CACHE_DURATION_MS;
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const weatherService = new WeatherService();
export default weatherService;
