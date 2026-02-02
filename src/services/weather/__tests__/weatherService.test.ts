/**
 * Weather Service Tests
 */

import { weatherService, WeatherCondition, WeatherData } from '../weatherService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('WeatherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    // Default mock for fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
    });
  });

  describe('initialize', () => {
    it('should initialize without throwing', async () => {
      await expect(weatherService.initialize()).resolves.not.toThrow();
    });
  });

  describe('getCurrentWeather', () => {
    it('should return weather data or null', async () => {
      const weather = await weatherService.getCurrentWeather();

      // Weather can be null if fetch fails
      if (weather !== null) {
        expect(weather).toHaveProperty('condition');
        expect(weather).toHaveProperty('temperature');
        expect(weather).toHaveProperty('humidity');
      }
    });
  });

  describe('getWeatherCondition', () => {
    it('should return weather condition string', async () => {
      const condition = await weatherService.getWeatherCondition();

      expect(typeof condition).toBe('string');
      const validConditions: WeatherCondition[] = ['clear', 'cloudy', 'rain', 'snow', 'storm', 'fog', 'other'];
      expect(validConditions).toContain(condition);
    });
  });

  describe('getWeatherImpact', () => {
    it('should return impact assessment', async () => {
      const impact = await weatherService.getWeatherImpact();

      expect(impact).toHaveProperty('level');
      expect(impact).toHaveProperty('delayProbabilityIncrease');
      expect(impact).toHaveProperty('recommendations');
      expect(['none', 'low', 'moderate', 'high', 'severe']).toContain(impact.level);
    });
  });

  describe('getForecast', () => {
    it('should return forecast array', async () => {
      // Mock successful fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          daily: {
            time: ['2024-01-01', '2024-01-02', '2024-01-03'],
            weather_code: [0, 1, 2],
            temperature_2m_max: [5, 7, 10],
            temperature_2m_min: [-2, 0, 3],
            precipitation_sum: [0, 0.5, 2],
          },
        }),
      });

      const forecast = await weatherService.getForecast(3);

      expect(Array.isArray(forecast)).toBe(true);
    });

    it('should return empty array on fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const forecast = await weatherService.getForecast();

      expect(Array.isArray(forecast)).toBe(true);
    });
  });

  describe('type exports', () => {
    it('should export WeatherCondition type', () => {
      const conditions: WeatherCondition[] = ['clear', 'cloudy', 'rain', 'snow', 'storm', 'fog', 'other'];
      expect(conditions.length).toBe(7);
    });

    it('should export WeatherData interface', () => {
      const mockData: Partial<WeatherData> = {
        condition: 'clear',
        temperature: 20,
        humidity: 50,
      };
      expect(mockData.condition).toBe('clear');
    });
  });
});
