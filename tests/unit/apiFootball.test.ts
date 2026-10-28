import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFootball } from '../../src/integrations/apiFootball.js';

const fetchMock = vi.fn();

function jsonResponse(
  body: unknown,
  init?: { ok?: boolean; status?: number; statusText?: string },
): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('apiFootball', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('sends the API key and query string', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse({
        get: 'leagues',
        parameters: {},
        errors: [],
        results: 0,
        paging: { current: 1, total: 1 },
        response: [],
      }),
    );

    await apiFootball.get('/leagues', { country: 'Portugal', season: 2025 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://v3.football.api-sports.io/leagues?country=Portugal&season=2025');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual(expect.objectContaining({ 'x-apisports-key': 'test_api_key' }));
  });

  it('returns the payload when errors is empty', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const payload = {
      get: 'status',
      parameters: {},
      errors: {},
      results: 1,
      paging: { current: 1, total: 1 },
      response: [{ account: 'ok' }],
    };
    fetchMock.mockResolvedValue(jsonResponse(payload));

    await expect(apiFootball.get('/status')).resolves.toEqual(payload);
    await expect(apiFootball.getStatus()).resolves.toEqual(payload);
  });

  it('throws on an HTTP failure before reading a body', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse(null, { ok: false, status: 429, statusText: 'Too Many Requests' }),
    );

    await expect(apiFootball.get('/fixtures')).rejects.toThrow(
      'API-Football request failed: 429 Too Many Requests',
    );
  });

  it('throws when the payload lists API errors as an array or an object', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const base = {
      get: 'leagues',
      parameters: {},
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ...base, errors: ['plan'] }))
      .mockResolvedValueOnce(
        jsonResponse({ ...base, errors: { token: 'Missing application key' } }),
      );

    await expect(apiFootball.get('/leagues')).rejects.toThrow('API-Football errors');
    await expect(apiFootball.get('/leagues')).rejects.toThrow('Missing application key');
  });
});
