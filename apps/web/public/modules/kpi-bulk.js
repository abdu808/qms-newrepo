/**
 * modules/kpi-bulk.js — إدخال مُجمَّع لقراءات KPI (CSV paste).
 *
 * يقبل أي من:
 *   code,year,month,actualValue[,spent]
 *   OBJ-001,2026,3,45
 *   ACT-002,2026,3,120,5000
 * أو JSON صفيف الصفوف. المطابقة تتم عن طريق code (نبحث في myDue.pending
 * و myDue.entered لنربط code → id + kind).
 */
(function () {
  'use strict';
  window.QmsKpiBulk = {
    bulk: {
      open: false,
      text: '',
      busy: false,
      result: null, // { total, inserted, failed: [{row, error}], rollup }
    },
    openBulkImport() {
      this.bulk = { open: true, text: '', busy: false, result: null };
    },
    closeBulkImport() {
      this.bulk.open = false;
    },
    _parseBulkRows(raw) {
      const out = [];
      const errors = [];
      const trimmed = String(raw || '').trim();
      if (!trimmed) return { rows: [], errors: ['لا توجد بيانات'] };

      // حاول JSON أولاً
      if (trimmed.startsWith('[')) {
        try {
          const arr = JSON.parse(trimmed);
          if (Array.isArray(arr)) return { rows: arr, errors };
        } catch {}
      }

      // خريطة: code → { id, kind }
      const byCode = {};
      const allItems = [...(this.myDue?.pending || []), ...(this.myDue?.entered || [])];
      for (const it of allItems) if (it.code) byCode[String(it.code).trim()] = it;

      const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      lines.forEach((line, idx) => {
        if (idx === 0 && /^(code|month)/i.test(line)) return; // تجاهل header
        const parts = line.split(/[,\t;]/).map(x => x.trim());
        if (parts.length < 4) {
          errors.push(`سطر ${idx + 1}: ينقص أعمدة (المتوقّع code,year,month,value[,spent])`);
          return;
        }
        const [code, yearS, monthS, actualS, spentS] = parts;
        const item = byCode[code];
        if (!item) { errors.push(`سطر ${idx + 1}: code غير معروف "${code}"`); return; }
        const year  = Number(yearS);
        const month = Number(monthS);
        const actualValue = Number(actualS);
        if (!year || !month || !isFinite(actualValue)) {
          errors.push(`سطر ${idx + 1}: قيم غير صحيحة`); return;
        }
        const row = { year, month, actualValue };
        if (item.kind === 'objective') row.objectiveId = item.id;
        else                            row.activityId  = item.id;
        if (spentS != null && spentS !== '') {
          const s = Number(spentS);
          if (isFinite(s)) row.spent = s;
        }
        out.push(row);
      });
      return { rows: out, errors };
    },
    async submitBulkImport() {
      const { rows, errors } = this._parseBulkRows(this.bulk.text);
      if (!rows.length) {
        alert('لا توجد صفوف صالحة.\n' + (errors.join('\n') || ''));
        return;
      }
      if (!confirm(`سيتم إدخال ${rows.length} قراءة. متابعة؟`)) return;
      this.bulk.busy = true;
      this.bulk.result = null;
      try {
        const res = await this.api('POST', '/kpi/entries/bulk', { rows });
        this.bulk.result = {
          total: res.total, inserted: res.inserted,
          failed: [...(res.failed || []), ...errors.map((e, i) => ({ row: -1, error: e }))],
          rollup: res.rollup,
        };
        this.toast?.(`✅ تم إدخال ${res.inserted}/${res.total} قراءة — roll-up تلقائي.`);
        await Promise.all([this.loadMyDueKpis?.(), this.loadMyWork?.()]);
      } catch (e) {
        alert(e.message || 'فشل الإدخال المُجمَّع');
      } finally {
        this.bulk.busy = false;
      }
    },
  };
})();
