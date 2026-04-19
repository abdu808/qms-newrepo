/**
 * modules/inbox.js — إجراءات workflow inline من بطاقات "مهامي"
 * لا تُجبر المستخدم على الانتقال إلى صفحة الوحدة كاملة لاتخاذ قرار بسيط.
 */
(function () {
  'use strict';
  window.QmsInbox = {
    _inboxBusy: {}, // { 'id:event': true }

    inboxBusy(item, event) {
      return !!this._inboxBusy[(item?.id || '') + ':' + event];
    },
    async _inboxCall(resource, item, event, body) {
      const key = (item?.id || '') + ':' + event;
      if (this._inboxBusy[key]) return;
      this._inboxBusy[key] = true;
      try {
        await this.api('POST', `/${resource}/${item.id}/${event}`, body);
        this.toast?.(`✅ تم الإجراء`);
        await this.loadMyWork();
      } catch (e) {
        alert(e.message || 'فشل الإجراء');
      } finally {
        this._inboxBusy[key] = false;
      }
    },
    async inboxSubmit(item, resource) {
      if (!confirm('إرسال هذه المسوّدة للمراجعة؟')) return;
      await this._inboxCall(resource, item, 'submit');
    },
    async inboxReview(item, resource) {
      await this._inboxCall(resource, item, 'review');
    },
    async inboxApprove(item, resource) {
      if (!confirm('اعتماد هذا السجل؟')) return;
      await this._inboxCall(resource, item, 'approve');
    },
    async inboxReject(item, resource) {
      const reason = prompt('سبب الرفض:');
      if (!reason || !reason.trim()) return;
      await this._inboxCall(resource, item, 'reject', { reason: reason.trim() });
    },
    canInbox(item, event) {
      const s = item?.workflowState || 'DRAFT';
      const role = this.user?.role;
      if (event === 'submit')  return s === 'DRAFT';
      if (event === 'review')  return s === 'SUBMITTED'   && ['QUALITY_MANAGER','SUPER_ADMIN','DEPT_MANAGER','COMMITTEE_MEMBER'].includes(role);
      if (event === 'approve') return s === 'UNDER_REVIEW' && ['QUALITY_MANAGER','SUPER_ADMIN','COMMITTEE_MEMBER'].includes(role);
      if (event === 'reject')  return ['SUBMITTED','UNDER_REVIEW'].includes(s) && ['QUALITY_MANAGER','SUPER_ADMIN','DEPT_MANAGER','COMMITTEE_MEMBER'].includes(role);
      return false;
    },
  };
})();
