import { useEffect, useRef } from 'react';

/**
 * The Life Planet — a low-poly world that grows with you.
 *  - trees  ← level & completed quests
 *  - flags  ← completed life milestones
 *  - moon   ← orbits faster with your current streak
 * three.js is loaded lazily so the desktop paints instantly.
 */
export interface PlanetProps {
  trees: number;
  flags: number;
  streak: number;
  dark: boolean;
  still?: boolean;
  /** Unlocked on the level road: moon2, houses, ring, satellite, aurora, gold */
  features?: string[];
}

type Three = typeof import('three');

export default function Planet(props: PlanetProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ update: (p: PlanetProps) => void; dispose: () => void } | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let cancelled = false;
    import('three').then((THREE) => {
      if (cancelled || !host.current) return;
      api.current = mount(THREE, host.current, latest.current);
    });
    return () => {
      cancelled = true;
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.update(props);
  }, [props.trees, props.flags, props.streak, props.dark, props.still, (props.features ?? []).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} className="planet" aria-hidden />;
}

/* ------------------------------------------------------------------ */

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const f = (t: number) => t * t * (3 - 2 * t);
  const u = f(xf), v = f(yf), w = f(zf);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
const fbm = (x: number, y: number, z: number) => noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.1;

function mount(THREE: Three, el: HTMLDivElement, initial: PlanetProps) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.35, 5.2);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xfff4e6, 0x8a6a55, 1.2);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0x9fb6ff, 1.2);
  rim.position.set(-4, 1, -3);
  scene.add(hemi, sun, rim);

  const world = new THREE.Group();
  world.rotation.z = 0.32;
  scene.add(world);

  /* ---- terrain ---- */
  const geo = new THREE.IcosahedronGeometry(1, 5).toNonIndexed();
  const pos = geo.attributes.position as InstanceType<Three['BufferAttribute']>;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const heights: number[] = [];
  const palette = {
    sand: new THREE.Color('#F2D7A6'),
    grass: new THREE.Color('#8FCB72'),
    grass2: new THREE.Color('#5FAE63'),
    rock: new THREE.Color('#B9A592'),
    snow: new THREE.Color('#FFFFFF'),
  };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = fbm(v.x * 1.6 + 5, v.y * 1.6 + 2, v.z * 1.6 + 9);
    const h = Math.max(0, n - 0.46) * 0.55;
    heights.push(h);
    v.multiplyScalar(1 + h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // colour per face by mean height for that crisp low-poly look
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const h = (heights[i] + heights[i + 1] + heights[i + 2]) / 3;
    if (h < 0.012) c.copy(palette.sand);
    else if (h < 0.07) c.copy(palette.grass);
    else if (h < 0.12) c.copy(palette.grass2);
    else if (h < 0.17) c.copy(palette.rock);
    else c.copy(palette.snow);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  world.add(land);

  const ocean = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.012, 4),
    new THREE.MeshStandardMaterial({ color: '#5EC4E8', flatShading: true, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.88 }),
  );
  world.add(ocean);

  /* ---- atmosphere halo ---- */
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 48, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: { tint: { value: new THREE.Color('#FFB38A') } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 tint; varying vec3 vN; void main(){ float i = pow(clamp(-vN.z, 0.0, 1.0), 1.7); gl_FragColor = vec4(tint, i * 0.75); }',
    }),
  );
  scene.add(halo);

  /* ---- land sample points (for trees & flags) ---- */
  const landSpots: { p: InstanceType<Three['Vector3']>; h: number }[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const h = (heights[i] + heights[i + 1] + heights[i + 2]) / 3;
    if (h > 0.02 && h < 0.13) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).add(new THREE.Vector3().fromBufferAttribute(pos, i + 1)).add(new THREE.Vector3().fromBufferAttribute(pos, i + 2)).divideScalar(3);
      landSpots.push({ p, h });
    }
  }
  // deterministic shuffle
  for (let i = landSpots.length - 1; i > 0; i--) {
    const j = Math.floor(hash3(i, 3, 7) * (i + 1));
    [landSpots[i], landSpots[j]] = [landSpots[j], landSpots[i]];
  }

  const deco = new THREE.Group();
  world.add(deco);
  const up = new THREE.Vector3(0, 1, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#9A6B4B', flatShading: true });
  const leafMats = ['#3E9B5F', '#59B36B', '#2F8A63', '#F29E6B'].map((col) => new THREE.MeshStandardMaterial({ color: col, flatShading: true }));
  const poleMat = new THREE.MeshStandardMaterial({ color: '#F5EFE6', flatShading: true });
  const flagMat = new THREE.MeshStandardMaterial({ color: '#FF6A3D', flatShading: true, side: THREE.DoubleSide });
  const trunkGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.05, 5);
  const leafGeo = new THREE.ConeGeometry(0.05, 0.1, 6);
  const bushGeo = new THREE.IcosahedronGeometry(0.04, 0);
  const poleGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.2, 5);
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.09, -0.025, 0), new THREE.Vector3(0, -0.055, 0)]);
  flagGeo.computeVertexNormals();

  const place = (obj: InstanceType<Three['Object3D']>, p: InstanceType<Three['Vector3']>) => {
    obj.position.copy(p);
    obj.quaternion.setFromUnitVectors(up, p.clone().normalize());
    deco.add(obj);
  };

  const houseGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const roofGeo = new THREE.ConeGeometry(0.055, 0.05, 4);
  const winGeo = new THREE.PlaneGeometry(0.018, 0.018);
  const houseMat = new THREE.MeshStandardMaterial({ color: '#FFF4E4', flatShading: true });
  const roofMats = ['#E0473C', '#3F7BE0', '#7A5AE6'].map((c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true }));
  const winMat = new THREE.MeshBasicMaterial({ color: '#FFD25E' });
  let houses = false;
  function buildDeco(trees: number, flags: number) {
    deco.clear();
    let k = 0;
    for (let i = 0; i < Math.min(flags, 24) && k < landSpots.length; i++, k++) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 0.1;
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(0.004, 0.2, 0);
      g.add(pole, flag);
      g.rotateY(hash3(i, 1, 1) * 6.28);
      place(g, landSpots[k].p);
    }
    for (let i = 0; i < Math.min(trees, 140) && k < landSpots.length; i++, k++) {
      const g = new THREE.Group();
      const s = 0.75 + hash3(i, 9, 2) * 0.6;
      if (houses && i % 6 === 2) {
        // a little house: body + roof + glowing window
        const body = new THREE.Mesh(houseGeo, houseMat);
        body.position.y = 0.03;
        const roof = new THREE.Mesh(roofGeo, roofMats[i % 3]);
        roof.position.y = 0.075;
        roof.rotation.y = Math.PI / 4;
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(0, 0.032, 0.0305);
        g.add(body, roof, win);
      } else if (i % 5 === 4) {
        const b = new THREE.Mesh(bushGeo, leafMats[1]);
        b.position.y = 0.02;
        g.add(b);
      } else {
        const t = new THREE.Mesh(trunkGeo, trunkMat);
        t.position.y = 0.025;
        const l = new THREE.Mesh(leafGeo, leafMats[i % 7 === 3 ? 3 : i % 3]);
        l.position.y = 0.09;
        g.add(t, l);
      }
      g.scale.setScalar(s);
      place(g, landSpots[k].p);
    }
  }

  /* ---- clouds ---- */
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, flatShading: true, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + j * 0.02 - (j === 2 ? 0.04 : 0), 0), cloudMat);
      m.position.set(j * 0.08 - 0.08, 0, 0);
      g.add(m);
    }
    const th = (i / 6) * Math.PI * 2;
    const ph = 0.5 + hash3(i, 2, 2) * 2;
    const r = 1.32;
    g.position.set(Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r, Math.sin(th) * Math.sin(ph) * r);
    g.lookAt(0, 0, 0);
    clouds.add(g);
  }
  world.add(clouds);

  /* ---- moon ---- */
  const moonPivot = new THREE.Group();
  moonPivot.rotation.x = 0.5;
  moonPivot.rotation.z = -0.25;
  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), new THREE.MeshStandardMaterial({ color: '#F6E7C8', flatShading: true, roughness: 0.8 }));
  moon.position.set(1.75, 0, 0);
  moonPivot.add(moon);
  scene.add(moonPivot);
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.004, 6, 160), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
  orbit.rotation.x = Math.PI / 2;
  moonPivot.add(orbit);

  /* ---- unlockable features ---- */
  const moon2Pivot = new THREE.Group();
  moon2Pivot.rotation.set(-0.6, 0, 0.5);
  const moon2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), new THREE.MeshStandardMaterial({ color: '#C9B6FF', flatShading: true, roughness: 0.7 }));
  moon2.position.set(-2.05, 0, 0);
  moon2Pivot.add(moon2);
  scene.add(moon2Pivot);

  const ringGroup = new THREE.Group();
  ringGroup.rotation.set(Math.PI / 2 - 0.35, 0.15, 0);
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.05, 3, 120), new THREE.MeshStandardMaterial({ color: '#F2C27A', flatShading: true, transparent: true, opacity: 0.85 }));
  ringA.scale.z = 0.25;
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.022, 3, 120), new THREE.MeshStandardMaterial({ color: '#FFE3B0', flatShading: true, transparent: true, opacity: 0.6 }));
  ringB.scale.z = 0.25;
  ringGroup.add(ringA, ringB);
  scene.add(ringGroup);

  const satPivot = new THREE.Group();
  satPivot.rotation.set(1.1, 0, 0.3);
  const sat = new THREE.Group();
  const satBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.1), new THREE.MeshStandardMaterial({ color: '#E8E8EE', metalness: 0.6, roughness: 0.3 }));
  const panelMat = new THREE.MeshStandardMaterial({ color: '#3F7BE0', metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide });
  const panelL = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), panelMat);
  panelL.position.x = -0.12;
  const panelR = panelL.clone();
  panelR.position.x = 0.12;
  sat.add(satBody, panelL, panelR);
  sat.position.set(0, 0, 1.9);
  satPivot.add(sat);
  scene.add(satPivot);

  const sparkGeo = new THREE.BufferGeometry();
  const sg = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) {
    const th = hash3(i, 7, 7) * Math.PI * 2;
    const ph = Math.acos(2 * hash3(i, 8, 1) - 1);
    const r = 1.35 + hash3(i, 3, 9) * 0.5;
    sg.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sg, 3));
  const sparkles = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: '#FFD66B', size: 0.05, transparent: true, opacity: 0.9 }));
  world.add(sparkles);

  /* ---- stars (dark mode) ---- */
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const r = 9 + hash3(i, 0, 1) * 6;
    const th = hash3(i, 1, 0) * Math.PI * 2;
    const ph = Math.acos(2 * hash3(i, 2, 3) - 1);
    sp.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), -Math.abs(r * Math.sin(ph) * Math.sin(th)) - 2], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.045, transparent: true, opacity: 0.8 }));
  scene.add(stars);

  /* ---- state ---- */
  let p = initial;
  let dirty = true; // when still, only re-render after a change or drag
  function applyTheme() {
    stars.visible = p.dark;
    hemi.intensity = p.dark ? 0.7 : 1.25;
    hemi.color.set(p.dark ? '#b8c4ff' : '#fff4e6');
    sun.intensity = p.dark ? 2.0 : 2.5;
    sun.color.set(p.dark ? '#ffe2c4' : '#ffffff');
    rim.intensity = p.dark ? 2.2 : 0.9;
    (halo.material as InstanceType<Three['ShaderMaterial']>).uniforms.tint.value.set(p.dark ? '#7D8CFF' : '#FFB38A');
    (orbit.material as InstanceType<Three['MeshBasicMaterial']>).opacity = p.dark ? 0.25 : 0.45;
    const f = new Set(p.features ?? []);
    moon2Pivot.visible = f.has('moon2');
    ringGroup.visible = f.has('ring');
    satPivot.visible = f.has('satellite');
    sparkles.visible = f.has('gold');
    const tint = f.has('gold') ? '#FFC94D' : f.has('aurora') ? (p.dark ? '#5CF2C0' : '#7BE0C3') : p.dark ? '#7D8CFF' : '#FFB38A';
    (halo.material as InstanceType<Three['ShaderMaterial']>).uniforms.tint.value.set(tint);
    if (f.has('houses') !== houses) {
      houses = f.has('houses');
      buildDeco(p.trees, p.flags);
    }
  }
  buildDeco(p.trees, p.flags);
  applyTheme();

  /* ---- interaction: drag to spin ---- */
  let vel = 0.0025;
  let drag = false;
  let lastX = 0;
  const onDown = (e: PointerEvent) => {
    drag = true;
    lastX = e.clientX;
    el.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    world.rotation.y += dx * 0.01;
    vel = dx * 0.0008;
    dirty = true;
  };
  const onUp = () => (drag = false);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);

  /* ---- sizing & loop ---- */
  const resize = () => {
    dirty = true;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(el);

  let raf = 0;
  const clock = new THREE.Clock();
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    if (p.still && !dirty && !drag) {
      clock.getDelta();
      return;
    }
    dirty = false;
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    if (!p.still) {
      if (!drag) vel += (0.0025 - vel) * 0.02;
      world.rotation.y += vel;
      clouds.rotation.y += dt * 0.05;
      moonPivot.rotation.y += dt * (0.25 + Math.min(p.streak, 60) * 0.012);
      moon2Pivot.rotation.y -= dt * 0.18;
      satPivot.rotation.y += dt * 0.6;
      sat.rotation.y += dt * 0.8;
      ringGroup.rotation.z += dt * 0.03;
      sparkles.rotation.y -= dt * 0.04;
      world.position.y = Math.sin(t * 0.8) * 0.03;
    }
    renderer.render(scene, camera);
  };
  tick();

  return {
    update(next: PlanetProps) {
      const rebuild = next.trees !== p.trees || next.flags !== p.flags;
      p = next;
      if (rebuild) buildDeco(p.trees, p.flags);
      // (features are applied in applyTheme)
      applyTheme();
      dirty = true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      scene.traverse((o) => {
        const m = o as InstanceType<Three['Mesh']>;
        m.geometry?.dispose?.();
        const mat = m.material as InstanceType<Three['Material']> | InstanceType<Three['Material']>[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
