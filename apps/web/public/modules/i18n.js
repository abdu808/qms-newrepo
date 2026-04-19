/**
 * modules/i18n.js — طبقة ترجمة ISO → عربي يومي
 * في الوضع "الموجَّه" نعرض اللفظ اليومي، وفي "المتقدّم" المصطلح الأصلي.
 * طبقة تقديم فقط — لا تُغيّر بيانات API.
 */
(function () {
  'use strict';
  window.QmsI18n = {
    ISO_DICT: {
      'ncr':               { friendly: 'بلاغ جودة',          iso: 'NCR',                 def: 'حالة عدم مطابقة: خطأ أو انحراف عن المعيار يحتاج تصحيحاً.' },
      'nc':                { friendly: 'بلاغ جودة',          iso: 'NC',                  def: 'Non-Conformance' },
      'capa':              { friendly: 'إجراء تصحيحي',       iso: 'CAPA',                def: 'Corrective & Preventive Action — خطوات إصلاح المشكلة ومنع تكرارها.' },
      'corrective action': { friendly: 'إجراء تصحيح',         iso: 'Corrective Action',   def: 'ما نفعله لإزالة سبب عدم المطابقة.' },
      'root cause':        { friendly: 'السبب الجذري',        iso: 'Root Cause',          def: 'السبب الحقيقي وراء المشكلة (وليس الأعراض).' },
      'kpi':               { friendly: 'مؤشّر أداء',          iso: 'KPI',                 def: 'رقم يقيس تحقّق هدف محدّد شهرياً أو سنوياً.' },
      'sla':               { friendly: 'مهلة الرد',           iso: 'SLA',                 def: 'Service Level Agreement — المدة القصوى للرد على الشكوى.' },
      'audit':             { friendly: 'تدقيق',              iso: 'Audit',               def: 'فحص منظَّم للتحقّق من الالتزام بالمعايير.' },
      'management review': { friendly: 'اجتماع متابعة الإدارة', iso: 'Management Review',   def: 'الاجتماع الدوري للإدارة العليا لمراجعة أداء الجودة.' },
      'risk':              { friendly: 'مخاطرة',             iso: 'Risk',                def: 'شيء محتمل قد يُعيق تحقيق هدف — ليس مشكلة حدثت فعلاً.' },
      'risk register':     { friendly: 'سجل المخاطر',         iso: 'Risk Register',       def: 'قائمة بكل المخاطر المعروفة في المنظمة.' },
      'complaint':         { friendly: 'شكوى',               iso: 'Complaint',           def: 'بلاغ من مستفيد عن خدمة غير مُرضية.' },
      'beneficiary':       { friendly: 'مستفيد',             iso: 'Beneficiary',         def: 'الشخص الذي يتلقى خدمات الجمعية.' },
      'donor':             { friendly: 'متبرّع',              iso: 'Donor',               def: 'جهة أو شخص يقدم دعماً مالياً/عينياً.' },
      'swot':              { friendly: 'تحليل الوضع',         iso: 'SWOT',                def: 'نقاط القوّة والضعف والفرص والتهديدات.' },
      'interested parties':{ friendly: 'الأطراف المعنيّة',    iso: 'Interested Parties',  def: 'كل من يتأثّر بعمل المنظمة (مستفيدون، موظفون، ممولون...).' },
      'policy':            { friendly: 'سياسة',              iso: 'Policy',              def: 'وثيقة توجّه اتخاذ القرارات في موضوع معيَّن.' },
      'procedure':         { friendly: 'إجراء',              iso: 'Procedure',           def: 'خطوات تنفيذ عمل ما.' },
      'objective':         { friendly: 'هدف تشغيلي',         iso: 'Objective',           def: 'هدف قابل للقياس ينبثق عن أهداف الجمعية.' },
      'strategic goal':    { friendly: 'هدف استراتيجي',      iso: 'Strategic Goal',      def: 'هدف طويل المدى (سنوات) للجمعية.' },
      'competence':        { friendly: 'كفاءة',              iso: 'Competence',          def: 'ما يجب أن يجيده الموظف لأداء عمله بجودة.' },
      'training':          { friendly: 'تدريب',              iso: 'Training',            def: 'جلسات لرفع كفاءة الموظفين.' },
      'acknowledgment':    { friendly: 'إقرار مطالعة',        iso: 'Acknowledgment',      def: 'توقيع يُثبت أنك اطّلعت على الوثيقة.' },
      'ack':               { friendly: 'إقرار',               iso: 'Ack',                 def: 'اختصار Acknowledgment.' },
      'supplier':          { friendly: 'مورِّد',              iso: 'Supplier',            def: 'جهة تُورِّد منتجات أو خدمات للجمعية.' },
      'workflow':          { friendly: 'مسار اعتماد',        iso: 'Workflow',            def: 'الخطوات المتسلسلة لاعتماد سجل (مسوّدة → مراجعة → اعتماد).' },
      'draft':             { friendly: 'مسوّدة',              iso: 'Draft',               def: 'سجل لم يُرسَل للمراجعة بعد.' },
      'submitted':         { friendly: 'مُرسَلة',             iso: 'Submitted',           def: 'بانتظار المراجع.' },
      'under review':      { friendly: 'قيد المراجعة',        iso: 'Under Review',        def: 'يُراجعها الجهة المختصّة.' },
      'approved':          { friendly: 'معتمدة',             iso: 'Approved',            def: 'تمّ اعتمادها رسمياً.' },
      'rejected':          { friendly: 'مرفوضة',             iso: 'Rejected',            def: 'لم تُعتَمد — تحتاج تعديلاً.' },
      'severity':          { friendly: 'درجة الخطورة',        iso: 'Severity',            def: 'مدى خطورة المشكلة أو المخاطرة.' },
    },
    _tLookup(term) {
      const k = String(term || '').toLowerCase().trim();
      return this.ISO_DICT[k] || null;
    },
    t(term) {
      const hit = this._tLookup(term);
      if (!hit) return term;
      return this.isGuided() ? hit.friendly : hit.iso;
    },
    tDef(term) {
      const hit = this._tLookup(term);
      return hit ? hit.def : '';
    },
    tFriendly(term) {
      const hit = this._tLookup(term);
      return hit ? hit.friendly : term;
    },
  };
})();
