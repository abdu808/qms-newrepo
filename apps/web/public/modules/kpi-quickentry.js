/**
 * modules/kpi-quickentry.js — السلسلة التشغيلية: إدخال KPI سريع + Undo + Live progress
 *
 * يُصدَّر ككائن على window.QmsKpiQuickEntry. يُدمج في app() عبر spread، فتعمل
 * دوالّه كأنها جزء من حالة Alpine (this يُربَط بكائن Alpine الرئيسي، مما يسمح
 * باستدعاء this.api / this.toast / this.loadMyWork).
 *
 * لا بناء (no bundler): الملف عادي <script>، يُحمَّل قبل app.js في index.html.
 */
(function () {
  'use strict';

  window.QmsKpiQuickEntry = {
    // ─── State ─────────────────────────────────────────────────
    myDue: { pending: [], entered: [], summary: null, month: null, year: null, loaded: false },
    _kpiDraft: {}, // { [id]: { actualValue, spent, busy, lastImpact } }
    _undoTicks: 0, // يُحرّك تقدير undoRemainingSec تفاعلياً

    // ─── Loaders ───────────────────────────────────────────────
    async loadMyDueKpis() {
      try {
        const r = await this.api('GET', '/kpi/my-due');
        this.myDue = {
          pending: r.pending || [],
          entered: r.entered || [],
          summary:  r.summary || null,
          month: r.month, year: r.year,
          loaded: true,
        };
      } catch {
        this.myDue = { pending: [], entered: [], summary: null, month: null, year: null, loaded: true };
      }
    },

    // ─── Draft helpers ─────────────────────────────────────────
    _draftFor(item) {
      const id = item.id;
      if (!this._kpiDraft[id]) {
        // إعادة تعيين الأب لتفعيل Alpine reactivity على مفاتيح ديناميكية
        this._kpiDraft = {
          ...this._kpiDraft,
          [id]: { actualValue: '', spent: '', busy: false, lastImpact: null },
        };
      }
      return this._kpiDraft[id];
    },

    // ─── Save: POST + rollup impact ────────────────────────────
    async quickSaveKpi(item) {
      const draft = this._draftFor(item);
      if (draft.busy) return;
      const val = Number(draft.actualValue);
      if (!isFinite(val) || draft.actualValue === null || draft.actualValue === '') {
        alert('أدخل قيمة رقمية للقراءة');
        return;
      }
      draft.busy = true;
      try {
        const prevProgress = await this._peekParentProgress(item);
        const body = { year: this.myDue.year, month: this.myDue.month, actualValue: val };
        if (item.kind === 'objective') body.objectiveId = item.id;
        else                            body.activityId  = item.id;
        if (draft.spent != null && draft.spent !== '') body.spent = Number(draft.spent);

        const res = await this.api('POST', '/kpi/entries', body);
        const newProgress = res?.rollup?.progress;
        const entryId = res?.entry?.id;
        if (newProgress != null) {
          const delta = newProgress - (prevProgress ?? 0);
          const arrow = delta >= 0 ? '↑' : '↓';
          draft.lastImpact = {
            prevProgress, newProgress, delta,
            ragMessage: res?.feedback?.message || '',
            entryId, undoneAt: null,
            undoExpiresAt: Date.now() + 10_000,
          };
          this._armUndoCountdown(item.id);
          this.toast?.(`✅ رفعتَ "${item.title}" من ${prevProgress ?? 0}% إلى ${newProgress}% ${arrow}`);
        } else {
          this.toast?.(`✅ تم حفظ قراءة "${item.title}"`);
        }
        draft.actualValue = ''; draft.spent = '';
        await Promise.all([this.loadMyDueKpis(), this.loadMyWork()]);
      } catch (e) {
        alert(e.message || 'فشل حفظ القراءة');
      } finally {
        draft.busy = false;
      }
    },

    async _peekParentProgress(item) {
      try {
        const path = item.kind === 'objective'
          ? `/objectives/${item.id}`
          : `/operational-activities/${item.id}`;
        const r = await this.api('GET', path);
        return r?.item?.progress ?? r?.progress ?? null;
      } catch { return null; }
    },

    // ─── Undo: حذف القراءة خلال 10 ثوانٍ ────────────────────────
    _armUndoCountdown(itemId) {
      const d = this._kpiDraft[itemId];
      if (!d?.lastImpact?.undoExpiresAt) return;
      const tick = () => {
        this._undoTicks++;
        if (!this._kpiDraft[itemId]?.lastImpact) return;
        if (Date.now() >= (this._kpiDraft[itemId].lastImpact.undoExpiresAt || 0)) return;
        setTimeout(tick, 500);
      };
      setTimeout(tick, 500);
    },
    undoRemainingSec(item) {
      const _ = this._undoTicks; // اعتماد تفاعلي
      const imp = this._kpiDraft[item.id]?.lastImpact;
      if (!imp?.undoExpiresAt || imp.undoneAt) return 0;
      return Math.max(0, Math.ceil((imp.undoExpiresAt - Date.now()) / 1000));
    },
    canUndo(item) { return this.undoRemainingSec(item) > 0; },

    async undoLastKpi(item) {
      const draft = this._draftFor(item);
      const imp = draft.lastImpact;
      if (!imp?.entryId || imp.undoneAt) return;
      if (!this.canUndo(item)) return;
      draft.busy = true;
      try {
        await this.api('DELETE', `/kpi/entries/${imp.entryId}`);
        imp.undoneAt = Date.now();
        draft.lastImpact = null;
        this.toast?.(`↩️ تم التراجع عن القراءة لـ "${item.title}"`);
        await Promise.all([this.loadMyDueKpis(), this.loadMyWork()]);
      } catch (e) {
        alert(e.message || 'فشل التراجع');
      } finally { draft.busy = false; }
    },
  };
})();
