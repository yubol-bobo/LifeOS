import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A cute 3D block chart: each column is a stack of soft clay cubes that drop in with a bounce,
 * and the top cube of every column has little blinking eyes. Hover a column for a tooltip,
 * drag to turn the whole shelf. three.js is loaded lazily (shared chunk).
 */
export interface BlockColumn {
  id: string;
  value: number;
  color: string; // css colour
}

type Three = typeof import('three');
type RoundedBox = typeof import('three/examples/jsm/geometries/RoundedBoxGeometry.js').RoundedBoxGeometry;

interface Api {
  update: (cols: BlockColumn[], dark: boolean) => void;
  dispose: () => void;
}

export function Blocks3D({
  columns,
  dark,
  height = 300,
  tooltip,
  onHover,
  still,
}: {
  columns: BlockColumn[];
  dark: boolean;
  height?: number;
  tooltip?: (id: string) => ReactNode;
  onHover?: (id: string | null) => void;
  still?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const latest = useRef({ columns, dark, still });
  latest.current = { columns, dark, still };
  const cb = useRef(onHover);
  cb.current = onHover;
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import('three'), import('three/examples/jsm/geometries/RoundedBoxGeometry.js')]).then(([THREE, rb]) => {
      if (cancelled || !host.current) return;
      api.current = mount(THREE, rb.RoundedBoxGeometry, host.current, latest, (id, x, y) => {
        setTip(id ? { id, x, y } : null);
        cb.current?.(id);
      });
      api.current.update(latest.current.columns, latest.current.dark);
    });
    return () => {
      cancelled = true;
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  const sig = JSON.stringify(columns.map((c) => [c.id, Math.round(c.value), c.color])) + dark;
  useEffect(() => {
    api.current?.update(columns, dark);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="blocks3d" ref={host} style={{ height }}>
      {tip && tooltip && (
        <div className="tip pie3d-tip" style={{ left: tip.x, top: tip.y }}>
          {tooltip(tip.id)}
        </div>
      )}
    </div>
  );
}

/** A friendly step so the tallest column is at most ~9 cubes. */
function unitFor(max: number) {
  const steps = [1, 2, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000, 2000, 5000];
  return steps.find((s) => max / s <= 9) ?? Math.ceil(max / 9);
}

const bounce = (t: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

function mount(
  THREE: Three,
  RoundedBoxGeometry: RoundedBox,
  el: HTMLDivElement,
  latest: { current: { columns: BlockColumn[]; dark: boolean; still?: boolean } },
  hover: (id: string | null, x: number, y: number) => void,
): Api {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'pan-y';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9b49a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(4, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
  sun.shadow.radius = 5;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe7cf, 0.5);
  fill.position.set(-5, 3, 2);
  scene.add(fill);
  // soft light on the faces so colours match the legend
  const front = new THREE.DirectionalLight(0xffffff, 0.75);
  front.position.set(0, 2.5, 9);
  scene.add(front);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const shelf = new THREE.Group();
  scene.add(shelf);

  const SIZE = 0.62;
  const GAP = 0.06;
  const cube = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.13);
  const eyeGeo = new THREE.SphereGeometry(0.055, 16, 12);
  const shineGeo = new THREE.SphereGeometry(0.018, 8, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.3 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cheekGeo = new THREE.CircleGeometry(0.06, 16);
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.55 });

  interface Col {
    id: string;
    group: InstanceType<Three['Group']>;
    blocks: { mesh: InstanceType<Three['Mesh']>; y: number; delay: number; scaleY: number }[];
    eyes: InstanceType<Three['Group']> | null;
    lift: number;
  }
  let cols: Col[] = [];
  let t0 = performance.now();
  let hovered: string | null = null;
  let blinkAt = performance.now() + 2000;

  const clear = () => {
    for (const c of cols) {
      shelf.remove(c.group);
      for (const b of c.blocks) (b.mesh.material as InstanceType<Three['Material']>).dispose();
    }
    cols = [];
  };

  const build = (data: BlockColumn[]) => {
    clear();
    const list = data.filter((d) => d.value > 0);
    if (!list.length) return;
    const max = Math.max(...list.map((d) => d.value));
    const unit = unitFor(max);
    const n = list.length;
    const step = SIZE + 0.34;
    let order = 0;
    list.forEach((d, i) => {
      const group = new THREE.Group();
      group.position.x = (i - (n - 1) / 2) * step;
      const mat = () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(d.color), roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) });
      const full = Math.floor(d.value / unit);
      const part = d.value / unit - full;
      const count = full + (part > 0.04 ? 1 : 0);
      const blocks: Col['blocks'] = [];
      let y = SIZE / 2;
      for (let k = 0; k < Math.max(1, count); k++) {
        const sy = k === full && part > 0.04 ? Math.max(0.35, part) : 1;
        const mesh = new THREE.Mesh(cube, mat());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.id = d.id;
        const h = SIZE * sy;
        const yy = y - SIZE / 2 + h / 2;
        mesh.scale.y = sy;
        mesh.position.y = yy + 6; // drops in from above
        group.add(mesh);
        blocks.push({ mesh, y: yy, delay: order++ * 55, scaleY: sy });
        y += h + GAP;
      }
      // a face on the top cube
      const top = blocks[blocks.length - 1];
      const face = new THREE.Group();
      for (const sx of [-1, 1]) {
        const e = new THREE.Mesh(eyeGeo, eyeMat);
        e.position.set(sx * 0.12, 0.04, SIZE / 2 + 0.01);
        e.scale.z = 0.6;
        const s = new THREE.Mesh(shineGeo, shineMat);
        s.position.set(sx * 0.12 + 0.02, 0.07, SIZE / 2 + 0.045);
        const ch = new THREE.Mesh(cheekGeo, cheekMat);
        ch.position.set(sx * 0.2, -0.07, SIZE / 2 + 0.012);
        face.add(e, s, ch);
      }
      face.scale.y = 1 / top.scaleY; // keep the face round on a squashed top cube
      top.mesh.add(face);
      shelf.add(group);
      cols.push({ id: d.id, group, blocks, eyes: face, lift: 0 });
    });
    // frame the shelf
    const width = n * step;
    const tallest = Math.max(...cols.map((c) => c.blocks.length)) * (SIZE + GAP);
    const span = Math.max(width * 0.62, tallest * 1.05, 3.2);
    camera.position.set(0, tallest * 0.55 + span * 0.5, span * 1.85);
    camera.lookAt(0, tallest * 0.42, 0);
    t0 = performance.now();
  };

  const size = () => {
    const w = el.clientWidth || 300;
    const h = el.clientHeight || 300;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(el);

  // ---- interaction ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag: { x: number; rot: number } | null = null;
  let lastInput = 0;
  const cvs = renderer.domElement;
  const pick = (cx: number, cy: number) => {
    const b = cvs.getBoundingClientRect();
    ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(cols.map((c) => c.group), true)[0];
    let o: InstanceType<Three['Object3D']> | null = hit?.object ?? null;
    while (o && !o.userData.id) o = o.parent;
    return { id: (o?.userData.id as string | undefined) ?? null, x: cx - b.left, y: cy - b.top };
  };
  const onMove = (e: PointerEvent) => {
    lastInput = performance.now();
    if (drag) {
      shelf.rotation.y = Math.max(-0.9, Math.min(0.9, drag.rot + (e.clientX - drag.x) * 0.008));
      return;
    }
    const p = pick(e.clientX, e.clientY);
    hovered = p.id;
    cvs.style.cursor = p.id ? 'pointer' : 'grab';
    hover(p.id, p.x, p.y);
  };
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, rot: shelf.rotation.y };
    cvs.setPointerCapture(e.pointerId);
  };
  const onUp = () => (drag = null);
  const onLeave = () => {
    hovered = null;
    hover(null, 0, 0);
  };
  cvs.addEventListener('pointermove', onMove);
  cvs.addEventListener('pointerdown', onDown);
  cvs.addEventListener('pointerup', onUp);
  cvs.addEventListener('pointerleave', onLeave);

  // ---- loop ----
  let raf = 0;
  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  });
  io.observe(el);
  const loop = (now: number) => {
    raf = 0;
    const still = latest.current.still;
    // gentle sway when idle
    if (!drag && !still && now - lastInput > 2500) shelf.rotation.y += (Math.sin(now / 2600) * 0.28 - shelf.rotation.y) * 0.02;
    const blink = now > blinkAt && now < blinkAt + 140;
    if (now > blinkAt + 140) blinkAt = now + 1800 + Math.random() * 2600;
    for (const c of cols) {
      for (const b of c.blocks) {
        const k = still ? 1 : Math.max(0, Math.min(1, (now - t0 - b.delay) / 520));
        b.mesh.position.y = b.y + (1 - bounce(k)) * 6;
      }
      const target = c.id === hovered ? 1 : 0;
      c.lift += (target - c.lift) * 0.18;
      c.group.position.y = 0.12 * c.lift;
      c.group.scale.setScalar(1 + 0.05 * c.lift);
      if (c.eyes) c.eyes.children.forEach((m, i) => i % 3 === 0 && (m.scale.y = blink ? 0.15 : 1));
    }
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    update: (data, dark) => {
      hemi.intensity = dark ? 0.8 : 0.95;
      hemi.groundColor.set(dark ? 0x2a2440 : 0xc9b49a);
      (ground.material as InstanceType<Three['ShadowMaterial']>).opacity = dark ? 0.35 : 0.14;
      build(data);
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
      cube.dispose();
      eyeGeo.dispose();
      shineGeo.dispose();
      cheekGeo.dispose();
      renderer.dispose();
      cvs.remove();
    },
  };
}
