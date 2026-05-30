import { playerRepository } from '../repositories/player.repository.js';
import { AppError } from '../utils/AppError.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Player, type Prisma } from '@prisma/client';

export const playerService = {
  async findAll(
    options: PaginationOptions,
    filters?: { teamId?: string; position?: string },
  ): Promise<PaginatedResult<Player>> {
    return playerRepository.findAll(options, filters);
  },

  async findById(id: string): Promise<Player> {
    const player = await playerRepository.findById(id);
    if (!player) throw AppError.notFound('Player', id);
    return player;
  },

  async findByExternalId(externalId: number): Promise<Player> {
    const player = await playerRepository.findByExternalId(externalId);
    if (!player) throw AppError.notFound('Player', externalId);
    return player;
  },

  async create(data: Prisma.PlayerCreateInput): Promise<Player> {
    return playerRepository.create(data);
  },

  async update(id: string, data: Prisma.PlayerUpdateInput): Promise<Player> {
    await playerService.findById(id);
    return playerRepository.update(id, data);
  },

  async delete(id: string): Promise<void> {
    await playerService.findById(id);
    await playerRepository.delete(id);
  },
};
