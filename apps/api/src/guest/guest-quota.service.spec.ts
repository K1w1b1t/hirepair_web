import { HttpStatus } from '@nestjs/common';
import Redis from 'ioredis';
import { GuestQuotaService } from './guest-quota.service';

jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn() }));

const redis = Redis as unknown as jest.Mock;

describe('GuestQuotaService', () => {
  const set = jest.fn();
  const del = jest.fn();
  const quit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    redis.mockImplementation(() => ({ set, del, quit }));
  });

  it('reserva uma análise por visitante e endereço', async () => {
    set.mockResolvedValue('OK');
    const service = new GuestQuotaService();

    await expect(service.reserveAnalysis('visitor-1', '127.0.0.1')).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith(
      expect.stringMatching(/^guest-analysis:/),
      '1',
      'EX',
      86_400,
      'NX',
    );
  });

  it('retorna 400 quando a análise gratuita já foi reservada', async () => {
    set.mockResolvedValue(null);
    const service = new GuestQuotaService();

    await expect(service.reserveAnalysis('visitor-1')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: expect.objectContaining({ code: 'GUEST_ANALYSIS_LIMIT_REACHED' }) as unknown,
    });
  });

  it('libera a reserva quando a análise falha', async () => {
    del.mockResolvedValue(1);
    const service = new GuestQuotaService();

    await expect(service.releaseAnalysis('visitor-1', '127.0.0.1')).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith(expect.stringMatching(/^guest-analysis:/));
  });

  it('converte falha do Redis em indisponibilidade segura', async () => {
    set.mockRejectedValue(new Error('redis down'));
    const service = new GuestQuotaService();

    await expect(service.reserveAnalysis('visitor-1')).rejects.toMatchObject({ status: 503 });
  });
});
