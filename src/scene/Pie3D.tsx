import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * An interactive 3D donut chart.
 *  - each slice's angle = its share; its height grows a little with its share, so big chunks stand out
 *  - a thin outer rim marks the slice's group (e.g. paid vs unpaid)
 *  - hover lifts a slice and shows a tooltip, click pins it, drag spins the chart, idle = slow spin
 * three.js is loaded lazily (shared chunk with the Life Planet).
 */
export interface PieSlice {
  id: string;
  value: number;
  color: string; // css colour
  rim?: string; // css colour of the group rim
}

type Three = typeof import('three');

interface Api {
  update: (slices: PieSlice[], dark: boolean) => void;
  select: (id: string | null) => void;
  dispose: () => void;
}

export function Pie3D({
  slices,
  dark,
  height = 300,
  selected,
  onSelect,
  onHover,
  tooltip,
  center,
  still,
}: {
  slices: PieSlice[];
  dark: boolean;
  height?: number;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  tooltip?: (id: string) => ReactNode;
  center?: ReactNode;
  still?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const cb = useRef({ onSelect, onHover });
  cb.current = { onSelect, onHover };
  const latest = useRef({ slices, dark, still });
  latest.current = { slices, dark, still };
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const [ctr, setCtr] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('three').then((THREE) => {
      if (cancelled || !host.current) return;
      api.current = mount(THREE, host.current, latest, {
        hover: (id, x, y) => {
          setTip(id ? { id, x, y } : null);
          cb.current.onHover?.(id);
        },
        click: (id) => cb.current.onSelect?.(id),
        center: (x, y) => setCtr((c) => (c && Math.abs(c.x - x) < 0.5 && Math.abs(c.y - y) < 0.5 ? c : { x, y })),
      });
      api.current.update(latest.current.slices, latest.current.dark);
    });
    return () => {
      cancelled = true;
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  // Rebuild only when the data actually changes (values are rounded by the caller).
  const sig = JSON.stringify(slices.map((s) => [s.id, Math.round(s.value), s.color, s.rim])) + dark;
  useEffect(() => {
    api.current?.update(slices, dark);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.current?.select(selected ?? null);
  }, [selected]);

  return (
    <div className="pie3d" ref={host} style={{ height }}>
      {center && ctr && (
        <div className="pie3d-center" style={{ left: ctr.x, top: ctr.y }}>
          {center}
        </div>
      )}
      {tip && tooltip && (
        <div className="tip pie3d-tip" style={{ left: tip.x, top: tip.y }}>
          {tooltip(tip.id)}
        </div>
      )}
    </div>
  );
}

function mount(
  THREE: Three,
  el: HTMLDivElement,
  latest: { current: { slices: PieSlice[]; dark: boolean; still?: boolean } },
  ev: { hover: (id: string | null, x: number, y: number) => void; click: (id: string | null) => void; center: (x: number, y: number) => void },
): Api {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // keep slice colours true to the legend
  el.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'pan-y';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 6.4, 7.4);
  camera.lookAt(0, 0.1, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb9a48c, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.55);
  sun.position.set(3.5, 8, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.radius = 6;
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0xffe2c4, 0.7);
  rimLight.position.set(-5, 3, -4);
  scene.add(rimLight);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  ground.receiveShadow = true;
  scene.add(ground);

  const pie = new THREE.Group();
  scene.add(pie);

  const R = 2.05;
  const r = 0.92;
  const GAP = 0.025; // radians between slices
  interface Piece {
    id: string;
    group: InstanceType<Three['Group']>;
    mid: number;
    mesh: InstanceType<Three['Mesh']>;
    lift: number;
    grow: number;
    delay: number;
  }
  let pieces: Piece[] = [];
  let lastIds = '';
  let hovered: string | null = null;
  let selected: string | null = null;
  let t0 = performance.now();

  const sector = (a0: number, a1: number, outer: number, inner: number) => {
    const sh = new THREE.Shape();
    const seg = Math.max(6, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 96));
    sh.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((a1 - a0) * i) / seg;
      sh.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    }
    for (let i = seg; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / seg;
      sh.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
    }
    return sh;
  };

  const clear = () => {
    for (const p of pieces) {
      pie.remove(p.group);
      p.group.traverse((o) => {
        const m = o as InstanceType<Three['Mesh']>;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as InstanceType<Three['Material']> | undefined;
        mat?.dispose?.();
      });
    }
    pieces = [];
  };

  const build = (slices: PieSlice[], animate: boolean) => {
    clear();
    const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0);
    if (!total) return;
    const max = Math.max(...slices.map((s) => s.value));
    let a = Math.PI / 2; // start at 12 o'clock (in the tilted view)
    const n = slices.filter((s) => s.value > 0).length;
    slices.forEach((s, i) => {
      if (s.value <= 0) return;
      const span = (s.value / total) * Math.PI * 2;
      const gap = n > 1 ? Math.min(GAP, span * 0.2) : 0;
      const a0 = a + gap / 2;
      const a1 = a + span - gap / 2;
      a += span;
      const h = 0.34 + 0.42 * (s.value / max);
      const geo = new THREE.ExtrudeGeometry(sector(a0, a1, R, n > 1 ? r : r), { depth: h, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 4 });
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(s.color), roughness: 0.42, metalness: 0.02, clearcoat: 0.6, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.id = s.id;
      const group = new THREE.Group();
      group.add(mesh);
      if (s.rim) {
        const rg = new THREE.ExtrudeGeometry(sector(a0, a1, R + 0.2, R + 0.09), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
        rg.rotateX(-Math.PI / 2);
        const rim = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: new THREE.Color(s.rim), roughness: 0.5 }));
        rim.receiveShadow = true;
        rim.userData.id = s.id;
        group.add(rim);
      }
      pie.add(group);
      pieces.push({ id: s.id, group, mid: (a0 + a1) / 2, mesh, lift: 0, grow: animate ? 0 : 1, delay: i * 70 });
    });
    t0 = performance.now();
  };

  const size = () => {
    const w = el.clientWidth || 300;
    const h = el.clientHeight || 300;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    // keep the whole donut in frame on narrow cards
    camera.position.set(0, 6.4, 7.4).multiplyScalar(w / h < 1.05 ? 1.05 : 0.86);
    camera.lookAt(0, 0.1, 0);
    camera.updateProjectionMatrix();
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(el);

  // ---- interaction ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag: { x: number; rot: number; moved: boolean } | null = null;
  let spin = 0; // inertial spin
  let lastInput = 0;
  const pick = (cx: number, cy: number) => {
    const b = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pieces.map((p) => p.group), true)[0];
    return { id: (hit?.object.userData.id as string | undefined) ?? null, x: cx - b.left, y: cy - b.top };
  };
  const onMove = (e: PointerEvent) => {
    lastInput = performance.now();
    if (drag) {
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      const next = drag.rot + dx * 0.012;
      spin = next - pie.rotation.y;
      pie.rotation.y = next;
      return;
    }
    const p = pick(e.clientX, e.clientY);
    hovered = p.id;
    renderer.domElement.style.cursor = p.id ? 'pointer' : 'grab';
    ev.hover(p.id, p.x, p.y);
  };
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, rot: pie.rotation.y, moved: false };
    spin = 0;
    renderer.domElement.setPointerCapture(e.pointerId);
  };
  const onUp = (e: PointerEvent) => {
    if (drag && !drag.moved) {
      const p = pick(e.clientX, e.clientY);
      selected = p.id && p.id !== selected ? p.id : null;
      ev.click(selected);
    }
    drag = null;
  };
  const onLeave = () => {
    hovered = null;
    ev.hover(null, 0, 0);
  };
  const cvs = renderer.domElement;
  cvs.addEventListener('pointermove', onMove);
  cvs.addEventListener('pointerdown', onDown);
  cvs.addEventListener('pointerup', onUp);
  cvs.addEventListener('pointerleave', onLeave);

  // ---- loop (paused while off-screen) ----
  let raf = 0;
  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  });
  io.observe(el);
  const centerV = new THREE.Vector3();
  let prev = performance.now();
  const loop = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    const still = latest.current.still;
    // idle spin / inertia
    if (!drag) {
      if (Math.abs(spin) > 0.0005) {
        pie.rotation.y += spin;
        spin *= 0.92;
      } else if (!still && !hovered && !selected && now - lastInput > 2500) pie.rotation.y += dt * 0.12;
    }
    for (const p of pieces) {
      // sweep in
      if (p.grow < 1) {
        const k = Math.max(0, Math.min(1, (now - t0 - p.delay) / 650));
        p.grow = 1 - Math.pow(1 - k, 3);
        p.group.scale.set(0.6 + 0.4 * p.grow, Math.max(0.001, p.grow), 0.6 + 0.4 * p.grow);
      }
      const target = p.id === hovered || p.id === selected ? 1 : 0;
      p.lift += (target - p.lift) * Math.min(1, dt * 12);
      const out = 0.16 * p.lift;
      // slices live in the XZ plane after rotateX: angle a maps to (cos a, -sin a)
      p.group.position.set(Math.cos(p.mid) * out, 0.22 * p.lift, -Math.sin(p.mid) * out);
      const mat = p.mesh.material as InstanceType<Three['MeshPhysicalMaterial']>;
      mat.emissive.setScalar(0.08 * p.lift);
    }
    renderer.render(scene, camera);
    // project the centre of the hole for the HTML label
    centerV.set(0, 0.55, 0).project(camera);
    ev.center(((centerV.x + 1) / 2) * el.clientWidth, ((1 - centerV.y) / 2) * el.clientHeight);
    if (visible) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const theme = (dark: boolean) => {
    hemi.intensity = dark ? 0.8 : 0.95;
    hemi.groundColor.set(dark ? 0x2a2440 : 0xb9a48c);
    (ground.material as InstanceType<Three['ShadowMaterial']>).opacity = dark ? 0.35 : 0.16;
  };

  return {
    update: (slices, dark) => {
      theme(dark);
      const ids = slices.map((s) => s.id).join('|');
      build(slices, ids !== lastIds);
      lastIds = ids;
      if (selected && !slices.some((s) => s.id === selected)) selected = null;
    },
    select: (id) => {
      selected = id;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      cvs.removeEventListener('pointermove', onMove);
      cvs.removeEventListener('pointerdown', onDown);
      cvs.removeEventListener('pointerup', onUp);
      cvs.removeEventListener('pointerleave', onLeave);
      clear();
      ground.geometry.dispose();
      renderer.dispose();
      cvs.remove();
    },
  };
}
