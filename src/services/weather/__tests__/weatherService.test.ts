/**
 * Weather Service Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { weatherService } from '../weatherService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@/models/ml', () => ({
  WeatherCondition: {},
}));

// Access private methods/state via casting
const service = weatherService as unknown as {
  cache: { data: unknown; timestamp: number };
  isCacheValid: () => boolean;
  calculateImpact: (weather: unknown) => unknown;
  initialize: () => Promise<void>;
  getCurrentWeather: () => Promise<unknown>;
  getWeatherCondition: () => Promise<string>;
  getWeatherImpact: () => Promise<unknown>;
  getForecast: (days?: number) => Promise<unknown[]>;
  shouldAlertForWeather: () => Promise<{ shouldAlert: boolean; message?: string }>;
  getWeatherIcon: (condition: string) => string;
  getWeatherDescription: (condition: string) => string;
};

describe('weatherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset cache
    service.cache = { data: null, timestamp: 0 };
    // Reset global fetch
    global.fetch = jest.fn();
  });

  describe('initialize', () => {
    it('should load cached data from storage', async () => {
      const cached = {
        data: {
          condition: 'clear',
          temperature: 20,
          humidity: 50,
          precipitation: 0,
          description: '맑음',
          icon: 'sun',
          timestamp: '2024-01-01T00:00:00.000Z',
          location: '서울',
        },
        timestamp: Date.now(),
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));

      await service.initialize();

      expect(AsyncStorage.getItem).toHaveBeenCalled();
      expect(service.cache.data).toBeDefined();
    });

    it('should handle missing cache gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await service.initialize();
      // No error should be thrown
    });

    it('should handle cache parse errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('fail'));

      await service.initialize();
      // No error should be thrown
    });
  });

  describe('getCurrentWeather', () => {
    it('should return cached data if valid', async () => {
      const weatherData = {
        condition: 'clear',
        temperature: 20,
        humidity: 50,
        precipitation: 0,
        description: '맑음',
        icon: 'sun',
        timestamp: new Date(),
        location: '서울',
      };
      service.cache = { data: weatherData, timestamp: Date.now() };

      const result = await service.getCurrentWeather();
      expect(result).toEqual(weatherData);
    });

    it('should fetch from API when cache is invalid', async () => {
      service.cache = { data: null, timestamp: 0 };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          current: {
            temperature_2m: 22,
            relative_humidity_2m: 60,
            weather_code: 0,
            precipitation: 0,
          },
        }),
      });

      const result = await service.getCurrentWeather();
      expect(result).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return null on fetch failure when no valid cache', async () => {
      service.cache = { data: null, timestamp: 0 };
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.getCurrentWeather();
      // With no cache data, should return null
      expect(result).toBeNull();
    });

    it('should return null when fetch fails and no cache', async () => {
      service.cache = { data: null, timestamp: 0 };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('parse error')),
      });

      const result = await service.getCurrentWeather();
      expect(result).toBeNull();
    });
  });

  describe('getWeatherCondition', () => {
    it('should return condition string', async () => {
      service.cache = {
        data: { condition: 'rain', temperature: 15, humidity: 80, precipitation: 5, description: '비', icon: 'cloud-rain', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const condition = await service.getWeatherCondition();
      expect(condition).toBe('rain');
    });

    it('should return clear when no weather data', async () => {
      service.cache = { data: null, timestamp: 0 };
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const condition = await service.getWeatherCondition();
      expect(condition).toBe('clear');
    });
  });

  describe('getWeatherImpact', () => {
    it('should return no impact for clear weather', async () => {
      service.cache = {
        data: { condition: 'clear', temperature: 20, humidity: 50, precipitation: 0, description: '맑음', icon: 'sun', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const impact = await service.getWeatherImpact() as { level: string; delayProbabilityIncrease: number; recommendations: string[] };
      expect(impact.level).toBe('none');
      expect(impact.delayProbabilityIncrease).toBe(0);
      expect(impact.recommendations).toEqual([]);
    });

    it('should return severe impact for heavy rain', async () => {
      service.cache = {
        data: { condition: 'rain', temperature: 15, humidity: 90, precipitation: 15, description: '비', icon: 'cloud-rain', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const impact = await service.getWeatherImpact() as { level: string; delayProbabilityIncrease: number; recommendations: string[] };
      expect(impact.level).toBe('severe');
      expect(impact.delayProbabilityIncrease).toBeGreaterThan(0);
      expect(impact.recommendations.length).toBeGreaterThan(0);
    });

    it('should return moderate impact for moderate rain', async () => {
      service.cache = {
        data: { condition: 'rain', temperature: 15, humidity: 80, precipitation: 7, description: '비', icon: 'cloud-rain', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const impact = await service.getWeatherImpact() as { level: string };
      expect(impact.level).toBe('moderate');
    });

    it('should return minor impact for light rain', async () => {
      service.cache = {
        data: { condition: 'rain', temperature: 15, humidity: 70, precipitation: 2, description: '비', icon: 'cloud-rain', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const impact = await service.getWeatherImpact() as { level: string };
      expect(impact.level).toBe('minor');
    });

    it('should return severe impact for snow', async () => {
      service.cache = {
        data: { condition: 'snow', temperature: -2, humidity: 85, precipitation: 5, description: '눈', icon: 'cloud-snow', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const impact = await service.getWeatherImpact() as { level: string; delayProbabilityIncrease: number };
      expect(impact.level).toBe('severe');
      expect(impact.delayProbabilityIncrease).toBeGreaterThanOrEqual(0.4);
    });

    it('should return moderate impact for fog', async () => {
      service.cache = {
        data: { condition: 'fog', temperature: 10, humidity: 95, precipitation: 0, description: '안개', icon: 'cloud-fog', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const impact = await service.getWeatherImpact() as { level: string };
      expect(impact.level).toBe('moderate');
    });

    it('should increase delay for extreme cold', async () => {
      service.cache = {
        data: { condition: 'clear', temperature: -15, humidity: 30, precipitation: 0, description: '맑음', icon: 'sun', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const impact = await service.getWeatherImpact() as { level: string; recommendations: string[] };
      expect(impact.level).toBe('minor');
      expect(impact.recommendations).toContain('한파 주의');
    });

    it('should increase delay for extreme heat', async () => {
      service.cache = {
        data: { condition: 'clear', temperature: 38, humidity: 60, precipitation: 0, description: '맑음', icon: 'sun', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const impact = await service.getWeatherImpact() as { level: string; recommendations: string[] };
      expect(impact.level).toBe('minor');
      expect(impact.recommendations).toContain('폭염 주의');
    });

    it('should return no impact when weather is null', async () => {
      service.cache = { data: null, timestamp: 0 };
      (global.fetch as jest.Mock).mockRejectedValue(new Error('fail'));

      const impact = await service.getWeatherImpact() as { level: string };
      expect(impact.level).toBe('none');
    });
  });

  describe('getForecast', () => {
    it('should return forecast data', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          daily: {
            time: ['2024-01-01', '2024-01-02'],
            weather_code: [0, 61],
            temperature_2m_max: [5, 3],
            temperature_2m_min: [-2, -1],
            precipitation_sum: [0, 5],
          },
        }),
      });

      const forecast = await service.getForecast(2);
      expect(forecast).toHaveLength(2);
    });

    it('should return empty array on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('fail'));

      const forecast = await service.getForecast();
      expect(forecast).toEqual([]);
    });

    it('should return empty on non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const forecast = await service.getForecast();
      expect(forecast).toEqual([]);
    });
  });

  describe('shouldAlertForWeather', () => {
    it('should alert for severe weather', async () => {
      service.cache = {
        data: { condition: 'snow', temperature: -5, humidity: 85, precipitation: 10, description: '눈', icon: 'cloud-snow', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const result = await service.shouldAlertForWeather();
      expect(result.shouldAlert).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should alert for moderate weather', async () => {
      service.cache = {
        data: { condition: 'fog', temperature: 10, humidity: 95, precipitation: 0, description: '안개', icon: 'cloud-fog', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const result = await service.shouldAlertForWeather();
      expect(result.shouldAlert).toBe(true);
    });

    it('should not alert for clear weather', async () => {
      service.cache = {
        data: { condition: 'clear', temperature: 20, humidity: 50, precipitation: 0, description: '맑음', icon: 'sun', timestamp: new Date(), location: '서울' },
        timestamp: Date.now(),
      };

      const result = await service.shouldAlertForWeather();
      expect(result.shouldAlert).toBe(false);
    });
  });

  describe('getWeatherIcon', () => {
    it('should return correct icons', () => {
      expect(service.getWeatherIcon('clear')).toBe('sun');
      expect(service.getWeatherIcon('rain')).toBe('cloud-rain');
      expect(service.getWeatherIcon('snow')).toBe('cloud-snow');
      expect(service.getWeatherIcon('fog')).toBe('cloud-fog');
      expect(service.getWeatherIcon('other')).toBe('cloud');
    });
  });

  describe('getWeatherDescription', () => {
    it('should return Korean descriptions', () => {
      expect(service.getWeatherDescription('clear')).toBe('맑음');
      expect(service.getWeatherDescription('rain')).toBe('비');
      expect(service.getWeatherDescription('snow')).toBe('눈');
      expect(service.getWeatherDescription('fog')).toBe('안개');
      expect(service.getWeatherDescription('other')).toBe('흐림');
    });
  });
});
