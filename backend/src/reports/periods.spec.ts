import { parseYmd, periodContaining, periodFrom, recentPeriods } from './periods';

describe('períodos del informe mensual', () => {
  it('día 13: del 13 de un mes al 12 del siguiente', () => {
    expect(periodContaining(parseYmd('2026-10-08'), 13)).toEqual({ from: '2026-09-13', to: '2026-10-12' });
    expect(periodContaining(parseYmd('2026-10-13'), 13)).toEqual({ from: '2026-10-13', to: '2026-11-12' });
    expect(periodContaining(parseYmd('2026-10-12'), 13)).toEqual({ from: '2026-09-13', to: '2026-10-12' });
  });

  it('día 1: mes calendario, incluido febrero', () => {
    expect(periodContaining(parseYmd('2026-02-15'), 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodContaining(parseYmd('2028-02-29'), 1)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('cruza el cambio de año', () => {
    expect(periodContaining(parseYmd('2027-01-05'), 13)).toEqual({ from: '2026-12-13', to: '2027-01-12' });
    expect(periodContaining(parseYmd('2026-12-20'), 13)).toEqual({ from: '2026-12-13', to: '2027-01-12' });
  });

  it('lista el período actual y los anteriores', () => {
    const periods = recentPeriods(parseYmd('2026-10-08'), 13, 3);
    expect(periods).toEqual([
      { from: '2026-09-13', to: '2026-10-12' },
      { from: '2026-08-13', to: '2026-09-12' },
      { from: '2026-07-13', to: '2026-08-12' },
    ]);
  });

  it('valida que el inicio coincida con el día de corte', () => {
    expect(periodFrom('2026-09-13', 13)).toEqual({ from: '2026-09-13', to: '2026-10-12' });
    expect(periodFrom('2026-09-01', 13)).toBeNull();
    expect(periodFrom('no-es-fecha', 13)).toBeNull();
  });
});
