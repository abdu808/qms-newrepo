/**
 * tests/reportBuilder.test.js — اختبارات وحدة لمحرّك Report Builder.
 * نختبر: listDatasets + buildWhere/safety + toCsv بدون ضرب قاعدة البيانات.
 */
import { describe, it, expect } from 'vitest';
import { listDatasets, toCsv, runReport, CATALOG } from '../src/lib/reportBuilder.js';

describe('reportBuilder · CATALOG', () => {
  it('datasets list has stable shape', () => {
    const ds = listDatasets();
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) {
      expect(d.key).toBeTypeOf('string');
      expect(d.label).toBeTypeOf('string');
      expect(Array.isArray(d.fields)).toBe(true);
      for (const f of d.fields) {
        expect(f).toHaveProperty('key');
        expect(f).toHaveProperty('type');
      }
    }
  });

  it('includes core datasets (ncr, complaints, documents)', () => {
    expect(CATALOG.ncr).toBeDefined();
    expect(CATALOG.complaints).toBeDefined();
    expect(CATALOG.documents).toBeDefined();
  });
});

describe('reportBuilder · runReport safety', () => {
  it('rejects unknown dataset', async () => {
    await expect(runReport({ dataset: 'hackerTable' })).rejects.toThrow(/مجموعة البيانات/);
  });

  it('rejects column outside whitelist', async () => {
    await expect(
      runReport({ dataset: 'ncr', columns: ['id', '__hackField'] })
    ).rejects.toThrow(/عمود غير مسموح/);
  });

  it('rejects filter on non-filter field', async () => {
    await expect(
      runReport({ dataset: 'ncr', filters: [{ field: '__hacker', op: 'eq', value: 'x' }] })
    ).rejects.toThrow(/غير مسموح بتصفيته/);
  });

  it('rejects unsupported operator', async () => {
    await expect(
      runReport({ dataset: 'ncr', filters: [{ field: 'code', op: 'sqlInject', value: 'x' }] })
    ).rejects.toThrow(/عامل تصفية غير مدعوم/);
  });

  it('rejects groupBy on non-groupable field', async () => {
    await expect(
      runReport({ dataset: 'ncr', groupBy: 'code' })
    ).rejects.toThrow(/لا يمكن التجميع/);
  });
});

describe('reportBuilder · toCsv', () => {
  it('serializes list mode with header + rows', () => {
    const csv = toCsv({
      mode: 'list',
      columns: ['code', 'title'],
      rows: [{ code: 'NCR-1', title: 'خطأ بسيط' }],
      total: 1,
    });
    // BOM + header + row
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('code,title');
    expect(csv).toContain('NCR-1');
  });

  it('escapes commas and quotes', () => {
    const csv = toCsv({
      mode: 'list',
      columns: ['title'],
      rows: [{ title: 'hello, "world"' }],
      total: 1,
    });
    expect(csv).toContain('"hello, ""world"""');
  });

  it('serializes groupBy mode with count aggregations', () => {
    const csv = toCsv({
      mode: 'groupBy', groupBy: 'status',
      rows: [
        { status: 'OPEN',   _count: { _all: 5 } },
        { status: 'CLOSED', _count: { _all: 3 } },
      ],
      total: 2,
    });
    expect(csv).toContain('status,_count._all');
    expect(csv).toContain('OPEN,5');
    expect(csv).toContain('CLOSED,3');
  });
});
