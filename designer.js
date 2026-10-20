/* ============================================================
   CamZone-EG | محرك التصميم ثلاثي الأبعاد (Three.js r128) — النسخة 2
   جديد: ملء الشاشة + عمود أدوات جانبي شفاف + مجسمات جاهزة + عدسات الكاميرا
   يعمل مع index.html: يبني الواجهة بنفسه داخل <div id="d3">
   ============================================================ */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('d3');
  if (!root) return;
  if (typeof THREE === 'undefined') { root.textContent = 'تعذر تحميل مكتبة Three.js'; return; }
  const say = m => (typeof toast === 'function' ? toast(m) : alert(m)); // إشعار الصفحة

  /* ===== الألوان الملكية (أسود لامع + ذهبي مطفي): عدّل من هنا ===== */
  const PAL = { gold: 0xd4af37, matte: 0xb8963e, ivory: 0xf5f0e1, grid: 0x2a2418, bg: 0x050506 };
  const GOLD_CSS = '#d4af37';

  /* ===== الإعدادات ===== */
  const CFG = {
    SNAP: 0.5,         // خطوة الالتصاق الشبكي بالمتر
    WALL_T: 0.2,       // سُمك الجدار
    CABLE_SLACK: 1.0,  // معامل زيادة السلك (1.1 = زيادة 10% للفضلة)
    CAM_TILT: 20       // ميل الكاميرا الافتراضي لأسفل بالدرجات
  };
  /* عدسات الكاميرا: زاوية الرؤية FOV بالدرجات وطول المخروط بالمتر (عدّل الأرقام من هنا) */
  const LENS = {
    '2.8': { fov: 90, len: 5 },    // عريض وقصير
    '3.6': { fov: 60, len: 8 },    // الافتراضي
    '6':   { fov: 40, len: 12 },   // أضيق للمسافات
    '12':  { fov: 20, len: 20 }    // ضيق جداً للزوم البعيد
  };
  const DEF_LENS = '3.6';

  const rad = d => THREE.MathUtils.degToRad(d);
  const snap = v => Math.round(v / CFG.SNAP) * CFG.SNAP;
  const fmt = n => (Math.round(n * 10) / 10) + 'm';

  /* ===== الأدوات: [المفتاح، الأيقونة، الاسم القصير، التلميح] ===== */
  const TOOLS = [
    ['select', '☝️', 'تحديد', 'اضغط على أي عنصر لتحديده'],
    ['wall', '🧱', 'جدار', 'اضغط نقطة البداية ثم النهاية، وكمّل بنفس الطريقة. اضغط الأداة مرة ثانية للإنهاء'],
    ['pole', '💡', 'عمود', 'اضغط على الأرض لوضع عمود إنارة'],
    ['gate', '🚧', 'بوابة', 'اضغط على الأرض لوضع البوابة'],
    ['door', '🚪', 'باب', 'اضغط على الأرض لوضع الباب'],
    ['window', '🪟', 'شباك', 'اضغط على الأرض لوضع الشباك'],
    ['power', '⚡', 'كهرباء', 'اضغط لوضع مصدر كهرباء'],
    ['switch', '🔀', 'سويتش', 'اضغط لوضع سويتش'],
    ['rack', '🗄️', 'راك', 'اضغط لوضع راك'],
    ['box', '📦', 'باوط', 'اضغط لوضع باوط'],
    ['cam', '📹', 'كاميرا', 'اضغط على جدار أو عمود لتركيب الكاميرا'],
    ['cable', '〰️', 'كابل', 'اضغط على كاميرا، ثم نقاط على الجدار، وأنهِ بالضغط على سويتش أو راك أو DVR']
  ];
  /* المجسمات الجاهزة (بضغطة واحدة على الأرض) */
  const PREFABS = [
    ['house', '🏠', 'منزل', 'اضغط على الأرض لإسقاط واجهة منزل كاملة (10×8 م، ارتفاع 3.2 م)'],
    ['warehouse', '🏗️', 'مخزن', 'اضغط لإسقاط مخزن (14×24 م، ارتفاع 6 م) بسقف جمالوني'],
    ['shop', '🏪', 'محل', 'اضغط لإسقاط محل بواجهة زجاجية (8×6 م)'],
    ['factory', '🏭', 'مصنع', 'اضغط لإسقاط مصنع (18×30 م، ارتفاع 8 م) بسقف جمالوني'],
    ['room', '🛏️', 'غرفة', 'اضغط لإسقاط غرفة مغلقة (5×4 م) بباب ونافذة'],
    ['control', '🖥️', 'تحكم', 'اضغط لإسقاط غرفة تحكم (4×3.5 م) بمكتب شاشات و DVR وراك وسويتش']
  ];

  /* ===== بناء الواجهة: كل شيء داخل مساحة الرسم (لينفع ملء الشاشة) ===== */
  root.innerHTML =
    '<div class="d3-stage" id="d3Wrap">' +
      '<button class="chip d3-fs" id="d3Fs" aria-label="ملء الشاشة">⛶</button>' +
      '<div class="d3-top"><div class="d3-hint" id="d3Hint"></div><div class="d3-hud" id="d3Hud"></div></div>' +
      '<div class="d3-side" id="d3Bar"></div>' +
      '<div class="d3-sel" id="d3Sel" hidden>' +
        '<div id="d3CamCtl">' +
          '<div class="d3-r"><label>Pan <input type="range" id="d3Pan" min="-180" max="180"></label>' +
          '<label>Tilt <input type="range" id="d3Tilt" min="-20" max="80"></label></div>' +
          '<div class="d3-r"><label>العدسة <select id="d3Lens">' +
            '<option value="2.8">2.8mm</option><option value="3.6" selected>3.6mm</option>' +
            '<option value="6">6mm</option><option value="12">12mm</option></select></label>' +
          '<button class="chip" id="d3Color">لون المخروط</button></div>' +
        '</div>' +
        '<div class="d3-r"><button class="chip" id="d3Rot">تدوير 90°</button><button class="chip" id="d3Del">حذف</button></div>' +
      '</div>' +
    '</div>';

  /* ===== المشهد والرندر (محسّن للأجهزة الضعيفة) ===== */
  const wrap = $('d3Wrap');
  const lowEnd = (navigator.hardwareConcurrency || 4) <= 4;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' });
  } catch (e) { wrap.textContent = 'المتصفح لا يدعم WebGL'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 1.5)); // أكبر مكسب في السلاسة
  renderer.setClearColor(PAL.bg);
  const cv = renderer.domElement; wrap.insertBefore(cv, wrap.firstChild);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(8, 14, 6); scene.add(sun); // بدون ظلال (أخف)
  scene.add(new THREE.GridHelper(60, 120, PAL.matte, PAL.grid));   // مربعات 0.5 متر
  const cam3 = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  // ملاحظة: الـ Frustum Culling مفعّل تلقائياً في Three.js لكل Mesh (frustumCulled=true)، فلا تغيّره

  const world = new THREE.Group(); scene.add(world);    // كل العناصر القابلة للضغط
  const labels = new THREE.Group(); scene.add(labels);  // أرقام أطوال الكابلات
  const cables = [];                                    // الكابلات المنتهية

  /* ===== الخامات والأشكال المشتركة (تُنشأ مرة واحدة = أداء أفضل) ===== */
  const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const MAT = {
    wall: L(0x5b6572), pole: L(0x8d949e), lamp: new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
    gate: L(PAL.matte), door: L(0x7a5a33), win: L(0x66b8ff, { transparent: true, opacity: 0.5 }),
    power: L(PAL.matte), sw: L(PAL.gold), rack: L(0x2b2f36), box: L(0xd8d8d8),
    cam: L(0xe3e3e3), lens: L(0x111111), steel: L(0x9aa0a8), floor: L(0x161618),
    desk: L(0x3a2f20), screen: new THREE.MeshBasicMaterial({ color: 0x1d2a38 }), dvr: L(0x1a1a1d),
    shelf: L(0x7a5a2a, { transparent: true, opacity: 0.75 }),
    cable: new THREE.LineBasicMaterial({ color: PAL.gold })
  };
  const PM = {   // ألوان جدران المجسمات الجاهزة
    house: L(0x8a8070), warehouse: L(0x5d646d), shop: L(0x73695a),
    factory: L(0x4e555d), room: L(0x6b6f75), control: L(0x4a4f57)
  };
  const coneMat = {   // مخروط الرؤية: شفاف ومضيء (ذهبي أو عاجي)
    gold:  new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    ivory: new THREE.MeshBasicMaterial({ color: PAL.ivory, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  };
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  // مخروط لكل عدسة (12 ضلع = Low-poly): القمة عند الأصل والقاعدة عند +Z
  Object.keys(LENS).forEach(k => {
    const { fov, len } = LENS[k];
    const g = new THREE.ConeGeometry(len * Math.tan(rad(fov / 2)), len, 12, 1, true);
    g.rotateX(-Math.PI / 2); g.translate(0, 0, len / 2); LENS[k].geo = g;
  });

  const bx = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(BOX, m); o.scale.set(w, h, d); o.position.set(x, y, z); return o; };
  const grp = (...c) => { const g = new THREE.Group(); c.forEach(o => g.add(o)); return g; };

  /* ===== أشكال العناصر المفردة ===== */
  const BUILD = {
    pole:   () => grp(bx(MAT.pole, .12, 4, .12, 0, 2, 0), bx(MAT.lamp, .5, .12, .3, .15, 4.05, 0)),
    gate:   () => grp(bx(MAT.pole, .2, 2.2, .2, -1.6, 1.1, 0), bx(MAT.pole, .2, 2.2, .2, 1.6, 1.1, 0), bx(MAT.gate, 3, 1.8, .08, 0, 1, 0)),
    door:   () => grp(bx(MAT.door, 1, 2.1, .12, 0, 1.05, 0)),
    window: () => grp(bx(MAT.win, 1.2, 1.1, .1, 0, 1.5, 0)),
    power:  () => grp(bx(MAT.power, .3, .3, .15, 0, 1.2, 0)),
    switch: () => grp(bx(MAT.sw, .4, .1, .25, 0, 1, 0)),
    rack:   () => grp(bx(MAT.rack, .6, 1.8, .6, 0, .9, 0), bx(MAT.sw, .5, .05, .02, 0, 1.5, .31)),
    box:    () => grp(bx(MAT.box, .25, .25, .12, 0, 2.2, 0))
  };

  /* ===== المجسمات الجاهزة (Prefabs): مقاسات حقيقية بالمتر ===== */
  // هيكل 4 جدران مغلقة بالمقاس (w عرض × d عمق × h ارتفاع). كل جدار علامته wall لتركيب الكاميرات والكابلات عليه
  function shell(g, w, d, h, mat) {
    const T = CFG.WALL_T;
    const mk = (len, x, z, ry) => {
      const m = new THREE.Mesh(BOX, mat); m.scale.set(len, h, T); m.position.set(x, h / 2, z); m.rotation.y = ry;
      m.userData = { wall: true }; g.add(m);
    };
    mk(w + T, 0, d / 2, 0); mk(w + T, 0, -d / 2, 0);                       // الأمامي والخلفي
    mk(d - T, w / 2, 0, Math.PI / 2); mk(d - T, -w / 2, 0, Math.PI / 2);   // الجانبان
    g.add(bx(MAT.floor, w, .04, d, 0, .02, 0));                            // أرضية داكنة
  }
  // فتحات مدمجة (أبواب/نوافذ/زجاج) على وجه الجدار: [الجهة f/b/l/r، الإزاحة، العرض، الارتفاع، مركز الارتفاع، الخامة]
  function openings(g, w, d, list) {
    const o = CFG.WALL_T / 2 + 0.03;
    list.forEach(([s, off, ww, hh, yc, m]) => {
      const p = bx(m, ww, hh, 0.06, 0, yc, 0);
      if (s === 'f') p.position.set(off, yc, d / 2 + o);
      else if (s === 'b') p.position.set(off, yc, -d / 2 - o);
      else { p.rotation.y = Math.PI / 2; p.position.set((s === 'r' ? 1 : -1) * (w / 2 + o), yc, off); }
      g.add(p);
    });
  }
  // سقف جمالوني (هيكل معدني): قطع مائلة + وتر أفقي + عمود + عارضة القمة
  function truss(g, w, d, h, rise, step) {
    const Lr = Math.hypot(w / 2, rise), a = Math.atan2(rise, w / 2), n = Math.max(1, Math.floor(d / step));
    for (let i = 0; i <= n; i++) {
      const z = -d / 2 + i * (d / n);
      const l = bx(MAT.steel, Lr, .14, .14, -w / 4, h + rise / 2, z); l.rotation.z = a;
      const r = bx(MAT.steel, Lr, .14, .14, w / 4, h + rise / 2, z); r.rotation.z = -a;
      g.add(l, r, bx(MAT.steel, w, .1, .1, 0, h, z), bx(MAT.steel, .1, rise, .1, 0, h + rise / 2, z));
    }
    g.add(bx(MAT.steel, .14, .14, d, 0, h + rise, 0));
  }
  // جهاز يصلح كنهاية للكابل (راك/سويتش/DVR)
  const dev = (m, k) => { m.userData = { dev: k, end: true }; return m; };

  const PRE = {
    house() {   // منزل 10×8 م، ارتفاع 3.2 م: باب أمامي + 3 نوافذ أمامية وجانبية + باب خلفي
      const g = new THREE.Group(), w = 10, d = 8; shell(g, w, d, 3.2, PM.house);
      openings(g, w, d, [['f', 0, 1.1, 2.2, 1.1, MAT.door], ['f', -3.2, 1.4, 1.2, 1.7, MAT.win], ['f', 3.2, 1.4, 1.2, 1.7, MAT.win],
        ['l', 0, 1.4, 1.2, 1.7, MAT.win], ['r', 0, 1.4, 1.2, 1.7, MAT.win], ['b', 0, 1.4, 1.2, 1.7, MAT.win], ['b', 3.5, 1, 2.1, 1.05, MAT.door]]);
      return g;
    },
    warehouse() {   // مخزن 14×24 م، ارتفاع 6 م: باب رول 4×4.5 + نوافذ علوية + سقف جمالوني + رفوف
      const g = new THREE.Group(), w = 14, d = 24; shell(g, w, d, 6, PM.warehouse);
      const o = [['f', 0, 4, 4.5, 2.25, MAT.gate]];
      [-8, 0, 8].forEach(z => { o.push(['l', z, 2, .8, 4.8, MAT.win], ['r', z, 2, .8, 4.8, MAT.win]); });
      openings(g, w, d, o); truss(g, w, d, 6, 1.5, 4);
      g.add(bx(MAT.shelf, 1.2, 3.5, 12, -3, 1.75, 0), bx(MAT.shelf, 1.2, 3.5, 12, 3, 1.75, 0));
      return g;
    },
    shop() {   // محل 8×6 م، ارتفاع 3.2 م: واجهة زجاجية 5×2.4 + باب + لافتة + نافذة جانبية + كاونتر
      const g = new THREE.Group(), w = 8, d = 6; shell(g, w, d, 3.2, PM.shop);
      openings(g, w, d, [['f', -.8, 5, 2.4, 1.4, MAT.win], ['f', 3, 1, 2.2, 1.1, MAT.door], ['f', 0, 7, .5, 2.95, MAT.gate], ['l', 0, 1.4, 1.2, 1.7, MAT.win]]);
      g.add(bx(MAT.desk, 2.5, 1, .7, -1, .5, -1.5));
      return g;
    },
    factory() {   // مصنع 18×30 م، ارتفاع 8 م: بابان كبيران 4×5 + نوافذ علوية + سقف جمالوني
      const g = new THREE.Group(), w = 18, d = 30; shell(g, w, d, 8, PM.factory);
      const o = [['f', -4.5, 4, 5, 2.5, MAT.gate], ['f', 4.5, 4, 5, 2.5, MAT.gate]];
      for (let i = 0; i < 5; i++) { const z = -10 + 5 * i; o.push(['l', z, 3, 1, 6.5, MAT.win], ['r', z, 3, 1, 6.5, MAT.win]); }
      openings(g, w, d, o); truss(g, w, d, 8, 2.5, 6);
      return g;
    },
    room() {   // غرفة 5×4 م، ارتفاع 2.8 م: 4 جدران مغلقة + باب + نافذة (مجسم واحد)
      const g = new THREE.Group(), w = 5, d = 4; shell(g, w, d, 2.8, PM.room);
      openings(g, w, d, [['f', 1.2, .9, 2.1, 1.05, MAT.door], ['l', 0, 1.2, 1.1, 1.5, MAT.win]]);
      return g;
    },
    control() {   // غرفة تحكم 4×3.5 م: مكتب + 3 شاشات + DVR + راك + سويتش (كلها نهايات للكابل)
      const g = new THREE.Group(), w = 4, d = 3.5; shell(g, w, d, 2.8, PM.control);
      openings(g, w, d, [['f', -1, .9, 2.1, 1.05, MAT.door]]);
      g.add(bx(MAT.desk, 2.2, .75, .7, .2, .375, -1.15));
      [-.55, .2, .95].forEach(x => g.add(bx(MAT.screen, .5, .32, .04, x, 1.1, -1.35)));
      g.add(dev(bx(MAT.dvr, .45, .08, .3, 1, .79, -1), 'dvr'));
      g.add(dev(bx(MAT.rack, .6, 1.8, .6, -1.5, .9, -1.2), 'rack'));
      g.add(dev(bx(MAT.sw, .4, .1, .25, 1.75, 1.4, .2), 'switch'));
      return g;
    }
  };

  /* ===== حالة التطبيق ===== */
  let tool = 'select', sel = null, wallStart = null, cab = null, dirty = true, visible = true;
  const need = () => { dirty = true; };
  const PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: PAL.gold }));
  marker.visible = false; scene.add(marker);
  const selBox = new THREE.BoxHelper(new THREE.Object3D(), PAL.ivory); selBox.visible = false; scene.add(selBox);

  /* ===== إضافة العناصر ===== */
  function addItem(kind, x, z) {
    const g = BUILD[kind](); g.position.set(x, 0, z); g.userData = { kind }; world.add(g); hud(); need(); return g;
  }
  function addPrefab(kind, x, z) {
    const g = PRE[kind](); g.position.set(x, 0, z); g.userData = { kind: 'prefab', name: kind }; world.add(g); hud(); need();
  }
  function addWall(a, b) {
    const len = a.distanceTo(b); if (len < 0.1) return;
    const h = +$('d3WallH').value;
    const m = new THREE.Mesh(BOX, MAT.wall);
    m.scale.set(len, h, CFG.WALL_T);
    m.position.set((a.x + b.x) / 2, h / 2, (a.z + b.z) / 2);
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    m.userData = { kind: 'wall', wall: true, h }; world.add(m); hud(); need();
  }
  function addCam(pos, yaw) {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const body = bx(MAT.cam, .18, .18, .34, 0, 0, 0);
    const cone = new THREE.Mesh(LENS[DEF_LENS].geo, coneMat.gold);
    cone.visible = false; cone.raycast = () => {};   // المخروط لا يعترض الضغط
    g.add(body, bx(MAT.lens, .1, .1, .06, 0, 0, .2), cone);
    g.position.copy(pos); g.rotation.y = yaw; g.rotation.x = rad(CFG.CAM_TILT);
    g.userData = { kind: 'cam', body, cone, color: 'gold', lens: DEF_LENS };
    world.add(g); hud(); need(); select(g);
  }

  /* ===== التحديد والتحكم (Pan/Tilt/العدسة) ===== */
  function select(o) {
    if (sel && sel.userData.cone) sel.userData.cone.visible = false;
    sel = o;
    if (o) {
      if (o.userData.cone) o.userData.cone.visible = true;   // المخروط يظهر عند اختيار الكاميرا
      selBox.setFromObject(o.userData.body || o); selBox.visible = true;
      if (o.userData.kind === 'cam') {
        let pd = THREE.MathUtils.radToDeg(o.rotation.y) % 360;
        if (pd > 180) pd -= 360; if (pd < -180) pd += 360;
        $('d3Pan').value = Math.round(pd);
        $('d3Tilt').value = Math.round(THREE.MathUtils.radToDeg(o.rotation.x));
        $('d3Lens').value = o.userData.lens;
      }
    } else selBox.visible = false;
    $('d3Sel').hidden = !o;
    $('d3CamCtl').style.display = o && o.userData.kind === 'cam' ? 'flex' : 'none';
    need();
  }
  $('d3Pan').oninput = e => { if (sel) { sel.rotation.y = rad(+e.target.value); selBox.update(); need(); } };
  $('d3Tilt').oninput = e => { if (sel) { sel.rotation.x = rad(+e.target.value); selBox.update(); need(); } };
  // تغيير العدسة: يغيّر زاوية المخروط وطوله فوراً
  $('d3Lens').onchange = e => {
    if (!sel || sel.userData.kind !== 'cam') return;
    sel.userData.lens = e.target.value; sel.userData.cone.geometry = LENS[e.target.value].geo; need();
  };
  $('d3Color').onclick = () => {
    if (!sel || !sel.userData.cone) return;
    sel.userData.color = sel.userData.color === 'gold' ? 'ivory' : 'gold';
    sel.userData.cone.material = coneMat[sel.userData.color]; need();
  };
  $('d3Rot').onclick = () => { if (sel) { sel.rotation.y += Math.PI / 2; selBox.update(); need(); } };
  $('d3Del').onclick = () => { if (sel) { removeObj(sel); select(null); } };

  function removeObj(o) {
    world.remove(o);
    for (let i = cables.length - 1; i >= 0; i--) {          // حذف الكابلات المرتبطة بالعنصر
      const c = cables[i];
      if (c.cam === o || c.end === o) { dropCable(c); cables.splice(i, 1); }
    }
    hud(); need();
  }
  function dropCable(c) { scene.remove(c.line); c.line.geometry.dispose(); labels.remove(c.label); c.label.material.map.dispose(); c.label.material.dispose(); }

  /* ===== الكابلات وحساب الأطوال ===== */
  const pathLen = p => p.reduce((s, v, i) => i ? s + v.distanceTo(p[i - 1]) : 0, 0);
  function pointAt(p, d) {          // نقطة على المسار عند مسافة d (لوضع الرقم في منتصف الخط)
    for (let i = 1; i < p.length; i++) {
      const s = p[i].distanceTo(p[i - 1]);
      if (d <= s) return p[i - 1].clone().lerp(p[i], s ? d / s : 0);
      d -= s;
    }
    return p[p.length - 1].clone();
  }
  function makeLabel(text) {        // رقم عائم (Sprite) فوق الخط
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(5,5,6,.9)'; x.fillRect(0, 0, 256, 96);
    x.strokeStyle = GOLD_CSS; x.lineWidth = 6; x.strokeRect(3, 3, 250, 90);
    x.fillStyle = GOLD_CSS; x.font = 'bold 54px Cairo, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 50);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    s.scale.set(1.8, 0.675, 1); return s;
  }
  const centerOf = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  function redrawLine() { cab.line.geometry.dispose(); cab.line.geometry = new THREE.BufferGeometry().setFromPoints(cab.pts); need(); }
  function cancelCable() { if (cab) { scene.remove(cab.line); cab.line.geometry.dispose(); cab = null; need(); } }
  // endObj: العنصر الأصلي (للحذف المرتبط)، centerObj: الجزء الذي يُحسب مركزه كنهاية للكابل
  function finishCable(endObj, centerObj) {
    cab.pts.push(centerOf(centerObj)); redrawLine();
    const raw = pathLen(cab.pts), len = raw * CFG.CABLE_SLACK;
    const lab = makeLabel(fmt(len));
    lab.position.copy(pointAt(cab.pts, raw / 2)).add(new THREE.Vector3(0, 0.5, 0));
    labels.add(lab);
    cables.push({ cam: cab.cam, end: endObj, line: cab.line, label: lab, len });
    cab = null; hud(); need(); say('طول الكابل: ' + fmt(len));
  }
  function cableTap(hit, gp) {
    if (!cab) {
      if (!hit || hit.kind !== 'cam') return say('ابدأ بالضغط على كاميرا');
      const p = new THREE.Vector3(); hit.obj.getWorldPosition(p);
      cab = { cam: hit.obj, pts: [p], line: new THREE.Line(new THREE.BufferGeometry(), MAT.cable) };
      scene.add(cab.line); redrawLine(); return say('اضغط نقاط على الجدار ثم السويتش أو الراك');
    }
    if (hit && hit.isEnd) return finishCable(hit.obj, hit.kind === 'prefab' ? hit.part : hit.obj);
    if (hit && hit.isWall) cab.pts.push(hit.point.clone().addScaledVector(hit.normal, 0.06)); // يلتصق بسطح الجدار
    else if (hit && hit.kind === 'box') cab.pts.push(centerOf(hit.obj));
    else if (gp) cab.pts.push(new THREE.Vector3(snap(gp.x), 0.05, snap(gp.z)));
    redrawLine();
  }

  /* ===== الضغط على المشهد ===== */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function onTap(e) {
    const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam3);
    const hs = ray.intersectObjects(world.children, true);
    let hit = null;
    if (hs.length) {
      const h = hs[0], leaf = h.object; let o = leaf;
      while (o.parent && o.parent !== world) o = o.parent;
      const k = o.userData.kind;
      hit = { obj: o, part: leaf, kind: k, point: h.point,
              normal: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null,
              isWall: !!leaf.userData.wall,                                           // جدار (مفرد أو داخل مجسم)
              isEnd: !!leaf.userData.end || k === 'switch' || k === 'rack' };         // نهاية كابل
    }
    const gp = ray.ray.intersectPlane(PLANE, new THREE.Vector3());   // نقطة الأرض (قد تكون null)

    if (tool === 'select') return select(hit ? hit.obj : null);
    if (tool === 'cable') return cableTap(hit, gp);
    if (tool === 'cam') {
      if (!hit || !hit.normal) return say('اضغط على جدار أو عمود');
      let n = hit.normal;
      if (hit.kind === 'pole') { const c = centerOf(hit.obj); n = new THREE.Vector3(hit.point.x - c.x, 0, hit.point.z - c.z).normalize(); }
      else if (!hit.isWall || Math.abs(n.y) > 0.5) return say('ركّب الكاميرا على جانب الجدار أو على عمود');
      const pos = hit.point.clone().addScaledVector(n, 0.17); pos.y = Math.max(pos.y, 1.5);
      return addCam(pos, Math.atan2(n.x, n.z));     // الكاميرا تواجه للخارج
    }
    if (!gp) return;
    const x = snap(gp.x), z = snap(gp.z);            // الالتصاق الشبكي
    if (tool === 'wall') {
      const p = new THREE.Vector3(x, 0, z);
      if (wallStart) addWall(wallStart, p);
      wallStart = p; marker.position.set(x, 0.12, z); marker.visible = true; need();
    } else if (PRE[tool]) addPrefab(tool, x, z);
    else if (BUILD[tool]) addItem(tool, x, z);
  }

  /* ===== العمود الجانبي الشفاف (يتمرر رأسياً على الموبايل) ===== */
  const hints = {}, bar = $('d3Bar');
  function head(t) { const h = document.createElement('h5'); h.textContent = t; bar.appendChild(h); }
  function toolBtn(k, i, n, h) {
    hints[k] = h;
    const b = document.createElement('button'); b.className = 'd3-btn'; b.dataset.k = k;
    b.innerHTML = '<span>' + i + '</span>' + n;
    b.onclick = () => setTool(k === tool && k === 'wall' ? 'select' : k);
    bar.appendChild(b);
  }
  head('أدوات'); TOOLS.forEach(t => toolBtn(...t));
  head('جاهز'); PREFABS.forEach(t => toolBtn(...t));
  head('خيارات');
  bar.insertAdjacentHTML('beforeend',
    '<label class="d3-lbl">ارتفاع الجدار<select id="d3WallH"><option>2.5</option><option selected>3</option><option>4</option></select></label>' +
    '<button class="d3-btn" id="d3Send"><span>⬇</span>للحاسبة</button>' +
    '<button class="d3-btn" id="d3Clear"><span>🗑️</span>مسح</button>');
  function setTool(k) {
    tool = k; wallStart = null; marker.visible = false; cancelCable();
    bar.querySelectorAll('.d3-btn[data-k]').forEach(b => b.classList.toggle('active', b.dataset.k === k));
    $('d3Hint').textContent = hints[k]; need();
  }
  setTool('select');

  /* ===== ملء الشاشة ===== */
  function setFull(on) {
    root.classList.toggle('d3-full', on);                 // يغطي الصفحة كلها (الهيدر وباقي العناصر تختفي)
    document.body.style.overflow = on ? 'hidden' : '';
    $('d3Fs').textContent = on ? '✕' : '⛶';
    if (on && root.requestFullscreen) root.requestFullscreen().catch(() => {});   // ملء شاشة المتصفح الحقيقي إن توفر
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    need();
  }
  $('d3Fs').onclick = () => setFull(!root.classList.contains('d3-full'));
  // الخروج بزر Esc من ملء الشاشة الحقيقي
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && root.classList.contains('d3-full')) setFull(false); });

  /* ===== الإحصائيات والنقل للحاسبة ===== */
  function count(k) {   // يعد العناصر المفردة + الأجهزة داخل المجسمات الجاهزة
    let n = 0;
    world.children.forEach(o => {
      if (o.userData.kind === k) n++;
      if (o.userData.kind === 'prefab') o.traverse(m => { if (m.userData.dev === k) n++; });
    });
    return n;
  }
  const totalCable = () => cables.reduce((s, c) => s + c.len, 0);
  function hud() {
    $('d3Hud').textContent = `كاميرات: ${count('cam')}  |  سويتش/راك: ${count('switch') + count('rack')}  |  باوط: ${count('box')}  |  كابلات: ${fmt(totalCable())}`;
  }
  $('d3Send').onclick = () => {
    if (typeof state === 'undefined') return say('الحاسبة غير موجودة');
    const n = count('cam'); if (!n) return say('ضع كاميرا واحدة على الأقل');
    state.cams = CAM_COUNTS.find(c => c >= n) || CAM_COUNTS[CAM_COUNTS.length - 1];   // أقرب اختيار متاح
    state.cable = Math.ceil(totalCable()); state.box = count('box');
    $('cableInput').value = state.cable; $('boxInput').value = state.box; render();
    if (root.classList.contains('d3-full')) setFull(false);       // نخرج من ملء الشاشة لنرى الحاسبة
    say('تم نقل البيانات للحاسبة');
    $('calc').scrollIntoView({ behavior: 'smooth' });
  };
  $('d3Clear').onclick = () => {
    if (!confirm('مسح كل التصميم؟')) return;
    select(null); cancelCable();
    cables.splice(0).forEach(dropCable);
    world.clear(); hud(); need();
  };

  /* ===== التحكم في الكاميرا: سحب = دوران، قرصة = تكبير وتحريك ===== */
  const view = { th: 0.8, ph: 1.0, r: 28, t: new THREE.Vector3() };
  function applyView() {
    view.ph = Math.min(1.5, Math.max(0.15, view.ph)); view.r = Math.min(90, Math.max(4, view.r));
    cam3.position.set(view.t.x + view.r * Math.sin(view.ph) * Math.sin(view.th), view.t.y + view.r * Math.cos(view.ph),
                      view.t.z + view.r * Math.sin(view.ph) * Math.cos(view.th));
    cam3.lookAt(view.t); need();
  }
  const ptrs = new Map(); let down = null, pinch = null;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = null;
    down = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: false } : null;
  });
  cv.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) {
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
      if (down && down.moved) { view.th -= dx * 0.008; view.ph -= dy * 0.008; applyView(); }
    } else if (ptrs.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch) {
        view.r *= pinch.d / d;
        const k = view.r * 0.0015, rx = Math.cos(view.th), rz = -Math.sin(view.th), fx = -Math.sin(view.th), fz = -Math.cos(view.th);
        view.t.x += -rx * (mx - pinch.mx) * k + fx * (my - pinch.my) * k;
        view.t.z += -rz * (mx - pinch.mx) * k + fz * (my - pinch.my) * k;
        applyView();
      }
      pinch = { d, mx, my }; return;
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId); pinch = null;
    if (e.type === 'pointerup' && down && !down.moved && performance.now() - down.t < 500) onTap(e);  // ضغطة وليست سحب
    down = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); view.r *= 1 + e.deltaY * 0.001; applyView(); }, { passive: false });

  /* ===== الحجم + الرسم عند الحاجة فقط (توفير بطارية وأداء) ===== */
  new ResizeObserver(() => {
    const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam3.aspect = w / h; cam3.updateProjectionMatrix(); need();
  }).observe(wrap);
  // إيقاف الرسم لما المصمم يكون خارج الشاشة
  new IntersectionObserver(en => { visible = en[0].isIntersecting; if (visible) need(); }).observe(wrap);
  (function loop() {
    requestAnimationFrame(loop);
    if (dirty && visible) { dirty = false; renderer.render(scene, cam3); }
  })();
  applyView(); hud();
})();
