import { type Request, type Response, type NextFunction } from 'express';

/* ── API Response Types ──────────────────────────────────── */

/**
 * Standardized success response envelope.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/**
 * Standardized error response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
  };
}

/**
 * Pagination metadata returned in list endpoints.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ── Pagination Query ────────────────────────────────────── */

/**
 * Standard pagination query parameters.
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/* ── Express Augmentation ────────────────────────────────── */

/**
 * Typed async request handler to pair with catchAsync utility.
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

/* ── Service Layer Types ─────────────────────────────────── */

/**
 * Base pagination input for service and repository layers.
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Paginated result from repository/service layer.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ── API-Football Types ──────────────────────────────────── */

/**
 * Generic API-Football response wrapper.
 */
export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}

/* ── API-Football Domain Types ──────────────────────────── */

/**
 * League response from GET /leagues.
 * @see https://www.api-football.com/documentation-v3#tag/Leagues
 */
export interface ApiFootballLeague {
  league: {
    id: number;
    name: string;
    type: string;         // "League" | "Cup"
    logo: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  seasons: Array<{
    year: number;
    start: string;
    end: string;
    current: boolean;
  }>;
}

/**
 * Team response from GET /teams.
 * @see https://www.api-football.com/documentation-v3#tag/Teams
 */
export interface ApiFootballTeam {
  team: {
    id: number;
    name: string;
    code: string | null;  // Short name, e.g. "POR"
    country: string;
    founded: number | null;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number | null;
    name: string | null;
    address: string | null;
    city: string | null;
    capacity: number | null;
    surface: string | null;
    image: string | null;
  };
}

/**
 * Fixture (match) response from GET /fixtures.
 * @see https://www.api-football.com/documentation-v3#tag/Fixtures
 */
export interface ApiFootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;            // ISO 8601
    timestamp: number;
    status: {
      long: string;          // "Match Finished", "Not Started", etc.
      short: string;         // "FT", "NS", "1H", "2H", "HT", "LIVE", etc.
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

/**
 * Fixture event response from GET /fixtures/events.
 * @see https://www.api-football.com/documentation-v3#tag/Fixtures/operation/get-fixtures-events
 */
export interface ApiFootballFixtureEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number | null;
    name: string | null;
  };
  type: string;       // "Goal", "Card", "subst", "Var"
  detail: string;     // "Normal Goal", "Yellow Card", "Red Card", "Substitution 1", etc.
  comments: string | null;
}

