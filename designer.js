/* ============================================================
   CamZone-EG | الجزء 2: محرك التصميم ثلاثي الأبعاد (Three.js r128)
   يشتغل مع index.html: يبني الواجهة بنفسه داخل <div id="d3">
   ينقل (عدد الكاميرات + أمتار السلك + البواطات) للحاسبة بزر واحد
   ============================================================ */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('d3');
  if (!root) return;
  const say = m => (typeof toast === 'function' ? toast(m) : alert(m)); // إشعار الصفحة

  /* ===== الإعدادات: عدّل من هنا ===== */
  const CFG = {
    SNAP: 0.5,          // خطوة الالتصاق الشبكي بالمتر
    FOV: 60,            // زاوية رؤية الكاميرا بالدرجات
    CONE_LEN: 8,        // طول مخروط الرؤية بالمتر
    WALL_T: 0.2,        // سُمك الجدار
    CABLE_SLACK: 1.0,   // معامل زيادة السلك (1.1 = زيادة 10% للفضلة)
    CAM_TILT: 20        // ميل الكاميرا الافتراضي لأسفل بالدرجات
  };
  const rad = d => THREE.MathUtils.degToRad(d);
  const snap = v => Math.round(v / CFG.SNAP) * CFG.SNAP;
  const fmt = n => (Math.round(n * 10) / 10) + 'm';

  /* ===== قائمة الأدوات (الزر، الاسم، التلميح) ===== */
  const TOOLS = [
    ['select', '☝️', 'تحديد', 'اضغط على أي عنصر لتحديده'],
    ['wall', '🧱', 'جدار', 'اضغط نقطة البداية ثم النهاية، وكمّل بنفس الطريقة. اضغط الأداة مرة ثانية للإنهاء'],
    ['pole', '💡', 'عمود إنارة', 'اضغط على الأرض لوضع العمود'],
    ['gate', '🚧', 'بوابة', 'اضغط على الأرض لوضع البوابة'],
    ['door', '🚪', 'باب', 'اضغط على الأرض لوضع الباب'],
    ['window', '🪟', 'شباك', 'اضغط على الأرض لوضع الشباك'],
    ['power', '⚡', 'كهرباء', 'اضغط لوضع مصدر كهرباء'],
    ['switch', '🔀', 'سويتش', 'اضغط لوضع سويتش'],
    ['rack', '🗄️', 'راك', 'اضغط لوضع راك'],
    ['box', '📦', 'باوط', 'اضغط لوضع باوط'],
    ['cam', '📹', 'كاميرا', 'اضغط على جدار أو عمود لتركيب الكاميرا'],
    ['cable', '〰️', 'كابل', 'اضغط على كاميرا، ثم نقاط على الجدار، وأنهِ بالضغط على سويتش أو راك']
  ];

  /* ===== بناء الواجهة داخل الصفحة ===== */
  root.innerHTML =
    '<div class="d3-bar" id="d3Bar"></div>' +
    '<div class="d3-opts">' +
      '<label>ارتفاع الجدار <select id="d3WallH"><option>2.5</option><option selected>3</option><option>4</option></select> م</label>' +
      '<button class="chip" id="d3Send">نقل للحاسبة ⬇</button>' +
      '<button class="chip" id="d3Clear">مسح الكل</button>' +
    '</div>' +
    '<div class="d3-wrap" id="d3Wrap"></div>' +
    '<div class="d3-hint" id="d3Hint"></div>' +
    '<div class="d3-sel" id="d3Sel" hidden>' +
      '<div id="d3CamCtl"><label>Pan <input type="range" id="d3Pan" min="-180" max="180"></label>' +
      '<label>Tilt <input type="range" id="d3Tilt" min="-20" max="80"></label>' +
      '<button class="chip" id="d3Color">لون المخروط</button></div>' +
      '<button class="chip" id="d3Rot">تدوير 90°</button>' +
      '<button class="chip" id="d3Del">حذف</button>' +
    '</div>' +
    '<div class="d3-hud" id="d3Hud"></div>';

  /* ===== المشهد والرندر (محسّن للأجهزة الضعيفة) ===== */
  const wrap = $('d3Wrap');
  const lowEnd = (navigator.hardwareConcurrency || 4) <= 4;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' });
  } catch (e) { wrap.textContent = 'المتصفح لا يدعم WebGL'; return; }
  // تقليل دقة البكسل على الأجهزة الضعيفة = أكبر مكسب في السلاسة
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 1.5));
  renderer.setClearColor(0x0a0a0c);
  const cv = renderer.domElement; wrap.appendChild(cv);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(8, 14, 6); scene.add(sun); // بدون ظلال (أخف)
  scene.add(new THREE.GridHelper(40, 80, 0x007fff, 0x14243d));  // مربعات 0.5 متر
  const cam3 = new THREE.PerspectiveCamera(55, 1, 0.1, 150);
  // ملاحظة: الـ Frustum Culling مفعّل تلقائياً في Three.js لكل Mesh (frustumCulled=true)، فلا تغيّره

  const world = new THREE.Group(); scene.add(world);    // كل العناصر القابلة للضغط
  const labels = new THREE.Group(); scene.add(labels);  // أرقام أطوال الكابلات
  const cables = [];                                    // الكابلات المنتهية

  /* ===== الخامات والأشكال المشتركة (تُنشأ مرة واحدة = أداء أفضل) ===== */
  const L = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const MAT = {
    wall: L(0x5b6572), pole: L(0x8d949e), lamp: new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
    gate: L(0xff7a1a), door: L(0xb07a45), win: L(0x66b8ff, { transparent: true, opacity: 0.55 }),
    power: L(0xff7a1a), sw: L(0x007fff), rack: L(0x2b2f36), box: L(0xd8d8d8),
    cam: L(0xe3e3e3), lens: L(0x111111), cable: new THREE.LineBasicMaterial({ color: 0xff7a1a })
  };
  const coneMat = {   // مخروط الرؤية: شفاف ومضيء (أزرق أو برتقالي)
    blue:   new THREE.MeshBasicMaterial({ color: 0x007fff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    orange: new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  };
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  // مخروط 12 ضلع فقط (Low-poly). القمة عند الأصل والقاعدة عند +Z
  const coneR = CFG.CONE_LEN * Math.tan(rad(CFG.FOV / 2));
  const CONE = new THREE.ConeGeometry(coneR, CFG.CONE_LEN, 12, 1, true);
  CONE.rotateX(-Math.PI / 2); CONE.translate(0, 0, CFG.CONE_LEN / 2);

  const bx = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(BOX, m); o.scale.set(w, h, d); o.position.set(x, y, z); return o; };
  const grp = (...c) => { const g = new THREE.Group(); c.forEach(o => g.add(o)); return g; };

  /* ===== أشكال العناصر (Low-poly من مكعبات) ===== */
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

  /* ===== حالة التطبيق ===== */
  let tool = 'select', sel = null, wallStart = null, cab = null, dirty = true, visible = true;
  const need = () => { dirty = true; };
  const PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
  marker.visible = false; scene.add(marker);
  const selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xff7a1a); selBox.visible = false; scene.add(selBox);

  /* ===== إضافة العناصر ===== */
  function addItem(kind, x, z) {
    const g = BUILD[kind](); g.position.set(x, 0, z); g.userData = { kind }; world.add(g); hud(); need(); return g;
  }
  function addWall(a, b) {
    const len = a.distanceTo(b); if (len < 0.1) return;
    const h = +$('d3WallH').value;
    const m = new THREE.Mesh(BOX, MAT.wall);
    m.scale.set(len, h, CFG.WALL_T);
    m.position.set((a.x + b.x) / 2, h / 2, (a.z + b.z) / 2);
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    m.userData = { kind: 'wall', h }; world.add(m); hud(); need();
  }
  function addCam(pos, yaw) {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const body = bx(MAT.cam, .18, .18, .34, 0, 0, 0);
    const cone = new THREE.Mesh(CONE, coneMat.blue);
    cone.visible = false; cone.raycast = () => {};   // المخروط لا يعترض الضغط
    g.add(body, bx(MAT.lens, .1, .1, .06, 0, 0, .2), cone);
    g.position.copy(pos); g.rotation.y = yaw; g.rotation.x = rad(CFG.CAM_TILT);
    g.userData = { kind: 'cam', body, cone, color: 'blue' };
    world.add(g); hud(); need(); select(g);
  }

  /* ===== التحديد والتحكم (Pan/Tilt) ===== */
  function select(o) {
    if (sel && sel.userData.cone) sel.userData.cone.visible = false;
    sel = o;
    if (o) {
      if (o.userData.cone) o.userData.cone.visible = true;   // المخروط يظهر عند اختيار الكاميرا
      selBox.setFromObject(o.userData.body || o); selBox.visible = true;
      if (o.userData.kind === 'cam') {
        $('d3Pan').value = Math.round(THREE.MathUtils.radToDeg(o.rotation.y) % 360 > 180 ? THREE.MathUtils.radToDeg(o.rotation.y) % 360 - 360 : THREE.MathUtils.radToDeg(o.rotation.y) % 360);
        $('d3Tilt').value = Math.round(THREE.MathUtils.radToDeg(o.rotation.x));
      }
    } else selBox.visible = false;
    $('d3Sel').hidden = !o;
    $('d3CamCtl').style.display = o && o.userData.kind === 'cam' ? 'flex' : 'none';
    need();
  }
  $('d3Pan').oninput = e => { if (sel) { sel.rotation.y = rad(+e.target.value); selBox.update(); need(); } };
  $('d3Tilt').oninput = e => { if (sel) { sel.rotation.x = rad(+e.target.value); selBox.update(); need(); } };
  $('d3Color').onclick = () => {
    if (!sel || !sel.userData.cone) return;
    sel.userData.color = sel.userData.color === 'blue' ? 'orange' : 'blue';
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
    x.fillStyle = 'rgba(10,10,12,.88)'; x.fillRect(0, 0, 256, 96);
    x.strokeStyle = '#ff7a1a'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 90);
    x.fillStyle = '#ff7a1a'; x.font = 'bold 54px Cairo, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 50);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    s.scale.set(1.8, 0.675, 1); return s;
  }
  const centerOf = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  function redrawLine() { cab.line.geometry.dispose(); cab.line.geometry = new THREE.BufferGeometry().setFromPoints(cab.pts); need(); }
  function cancelCable() { if (cab) { scene.remove(cab.line); cab.line.geometry.dispose(); cab = null; need(); } }
  function finishCable(endObj) {
    cab.pts.push(centerOf(endObj)); redrawLine();
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
    if (hit && (hit.kind === 'switch' || hit.kind === 'rack')) return finishCable(hit.obj);
    if (hit && hit.kind === 'wall') cab.pts.push(hit.point.clone().addScaledVector(hit.normal, 0.06)); // يلتصق بسطح الجدار
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
      const h = hs[0]; let o = h.object;
      while (o.parent && o.parent !== world) o = o.parent;
      hit = { obj: o, kind: o.userData.kind, point: h.point,
              normal: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null };
    }
    const gp = ray.ray.intersectPlane(PLANE, new THREE.Vector3());   // نقطة الأرض (قد تكون null)

    if (tool === 'select') return select(hit ? hit.obj : null);
    if (tool === 'cable') return cableTap(hit, gp);
    if (tool === 'cam') {
      if (!hit || !hit.normal) return say('اضغط على جدار أو عمود');
      let n = hit.normal;
      if (hit.kind === 'pole') { const c = centerOf(hit.obj); n = new THREE.Vector3(hit.point.x - c.x, 0, hit.point.z - c.z).normalize(); }
      else if (hit.kind !== 'wall' || Math.abs(n.y) > 0.5) return say('ركّب الكاميرا على جانب الجدار أو على عمود');
      const pos = hit.point.clone().addScaledVector(n, 0.17); pos.y = Math.max(pos.y, 1.5);
      return addCam(pos, Math.atan2(n.x, n.z));     // الكاميرا تواجه للخارج
    }
    if (!gp) return;
    const x = snap(gp.x), z = snap(gp.z);            // الالتصاق الشبكي
    if (tool === 'wall') {
      const p = new THREE.Vector3(x, 0, z);
      if (wallStart) addWall(wallStart, p);
      wallStart = p; marker.position.set(x, 0.12, z); marker.visible = true; need();
    } else if (BUILD[tool]) addItem(tool, x, z);
  }

  /* ===== شريط الأدوات ===== */
  const hints = {};
  TOOLS.forEach(([k, i, n, h]) => {
    hints[k] = h;
    const b = document.createElement('button'); b.className = 'chip'; b.dataset.k = k; b.textContent = i + ' ' + n;
    b.onclick = () => setTool(k === tool && k === 'wall' ? 'select' : k);
    $('d3Bar').appendChild(b);
  });
  function setTool(k) {
    tool = k; wallStart = null; marker.visible = false; cancelCable();
    $('d3Bar').querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.k === k));
    $('d3Hint').textContent = hints[k]; need();
  }
  setTool('select');

  /* ===== الإحصائيات والنقل للحاسبة ===== */
  const count = k => world.children.filter(o => o.userData.kind === k).length;
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
  const view = { th: 0.8, ph: 1.0, r: 22, t: new THREE.Vector3() };
  function applyView() {
    view.ph = Math.min(1.5, Math.max(0.15, view.ph)); view.r = Math.min(70, Math.max(4, view.r));
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
