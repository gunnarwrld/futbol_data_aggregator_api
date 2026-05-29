import { describe, it, expect, vi } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import { apiResponse } from '../../src/utils/apiResponse.js';

describe('apiResponse', () => {
  const mockRes = (): Response => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as Response;
    return res;
  };

  describe('success', () => {
    it('should send a success response with data', () => {
      const res = mockRes();
      const data = { id: 1, name: 'Premier League' };

      apiResponse.success(res, 200, data);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should include meta when provided', () => {
      const res = mockRes();
      const data = [{ id: 1 }];
      const meta = { page: 1, limit: 20, total: 100, totalPages: 5 };

      apiResponse.success(res, 200, data, meta);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        meta,
      });
    });
  });

  describe('paginated', () => {
    it('should send a paginated response with status 200', () => {
      const res = mockRes();
      const data = [{ id: 1 }, { id: 2 }];
      const meta = { page: 1, limit: 20, total: 2, totalPages: 1 };

      apiResponse.paginated(res, data, meta);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        meta,
      });
    });
  });

  describe('created', () => {
    it('should send a 201 response with data', () => {
      const res = mockRes();
      const data = { id: 1, name: 'New League' };

      apiResponse.created(res, data);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });
  });

  describe('noContent', () => {
    it('should send a 204 response with no body', () => {
      const res = mockRes();

      apiResponse.noContent(res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledWith();
    });
  });
});
