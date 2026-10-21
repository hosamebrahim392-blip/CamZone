/* ============================================================
   CamZone-EG | ملف الإعدادات الموحد والآمن
   ============================================================ */

const SUPABASE_URL = 'https://supabase.co';
// ⚠️ تأكد من استبدال النص بالأسفل بمفتاح anon public الطويل الخاص بك
const SUPABASE_KEY = 'sb_publishable_nEzdxJgPSD5iiIcRkJWw7A_h5TNW49p'; 

// الربط بالطريقة القديمة والجديدة معاً لضمان عمل كل الصفحات
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_KEY;

window.CZ = {
  URL: SUPABASE_URL,
  KEY: SUPABASE_KEY,
  getClient: function() {
    if (!window.supabase) return null;
    if (!this._client) this._client = window.supabase.createClient(this.URL, this.KEY);
    return this._client;
  }
};

// تشغيل الربط المباشر للمتصفح فوراً
if (window.supabase) {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
