/* ============================================================
   CamZone-EG | إعدادات Supabase الاحترافية
   الجهة: Project Settings > API
   تنبيه أمني: يتم وضع مفتاح anon (العام) فقط لحماية البيانات.
   ============================================================ */

window.CZ = {
  // 1) رابط مشروعك الصحيح
  URL: 'https://qlzgcwmdaiverqrbmmah.supabase.co', 

  // 2) استبدل النص بالأسفل بالمفتاح الطويل (anon public) الذي نسخته
  KEY: 'sb_publishable_nEzdxJgPSD5iiIcRkJWw7A_h5TNW49p', 
  
  // دالة مساعدة ذكية للتأكد من ربط العميل بدون تكرار الكود في صفحاتك
  getClient: function() {
    if (!window.supabase) {
      console.error("خطأ: مكتبة Supabase لم يتم تحميلها في ملف الـ HTML الرئيسي!");
      return null;
    }
    if (!this._client) {
      this._client = window.supabase.createClient(this.URL, this.KEY);
    }
    return this._client;
  }
};

// تجميد الكائن لمنع أي كود خبيث أو خطأ برمجي من تعديل الإعدادات أثناء تشغيل التطبيق
Object.freeze(window.CZ);
