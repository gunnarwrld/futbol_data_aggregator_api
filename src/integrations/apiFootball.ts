import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { type ApiFootballResponse } from '../types/index.js';

/**
 * API-Football HTTP client.
 *
 * Centralized client for making requests to the API-Football v3 API.
 * Handles authentication, rate limiting awareness, and error mapping.
 *
 * @see https://www.api-football.com/documentation-v3
 *
 * API-Football Rate Limits (Free Tier):
 * - 100 requests/day
 * - 10 requests/minute
 */
export const apiFootball = {
  /**
   * Base headers for all API-Football requests.
   */
  get headers(): Record<string, string> {
    return {
      'x-apisports-key': config.API_FOOTBALL_KEY,
      'Content-Type': 'application/json',
    };
  },

  /**
   * Make a GET request to API-Football.
   *
   * @param endpoint - API endpoint path (e.g., '/leagues', '/fixtures')
   * @param params - Query parameters
   * @returns Parsed API-Football response
   *
   * @example
   * ```ts
   * const response = await apiFootball.get<LeagueResponse>('/leagues', { country: 'England' });
   * ```
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number>,
  ): Promise<ApiFootballResponse<T>> {
    const url = new URL(`${config.API_FOOTBALL_BASE_URL}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    logger.debug({ endpoint, params }, 'API-Football request');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: apiFootball.headers,
    });

    if (!response.ok) {
      logger.error(
        {
          endpoint,
          status: response.status,
          statusText: response.statusText,
        },
        'API-Football request failed',
      );

      throw new Error(
        `API-Football request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as ApiFootballResponse<T>;

    // Check for API-level errors
    if (
      data.errors &&
      ((Array.isArray(data.errors) && data.errors.length > 0) ||
        (!Array.isArray(data.errors) && Object.keys(data.errors).length > 0))
    ) {
      logger.error({ endpoint, errors: data.errors }, 'API-Football returned errors');
      throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`);
    }

    logger.debug(
      { endpoint, results: data.results },
      'API-Football response received',
    );

    return data;
  },

  /**
   * Check the current API usage / rate limit status.
   */
  async getStatus(): Promise<unknown> {
    return apiFootball.get('/status');
  },
};
