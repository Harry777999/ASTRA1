import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { catalog } from "./model";
import type { Project } from "./model";

export type WorldHandle = {
  zoom: (direction: number) => void;
  reset: () => void;
};
type Props = {
  project: Project;
  selected: string | null;
  connecting: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, z: number) => void;
};
type Label = { id: string; x: number; y: number };

function roundedShape(size: number, radius: number) {
  const s = new THREE.Shape();
  const h = size / 2;
  const r = radius;
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r);
  s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r);
  s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

function tile(size: number, height: number, color: THREE.ColorRepresentation) {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(size, 0.14), {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 6,
  });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.32 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export const World = forwardRef<WorldHandle, Props>(function World(
  { project, selected, connecting, onSelect, onMove },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const selectionRef = useRef(new Map<string, THREE.Mesh>());
  const callbacks = useRef({ onSelect, onMove });
  callbacks.current = { onSelect, onMove };
  const zoomRef = useRef(1);
  const [labels, setLabels] = useState<Label[]>([]);
  const [fallback, setFallback] = useState(false);

  useImperativeHandle(ref, () => ({
    zoom(direction) {
      const c = cameraRef.current;
      if (c) {
        c.zoom = THREE.MathUtils.clamp(
          c.zoom * (direction > 0 ? 1.2 : 1 / 1.2),
          0.35,
          2,
        );
        zoomRef.current = c.zoom;
        c.updateProjectionMatrix();
        controlsRef.current?.dispatchEvent({ type: "change" });
      }
    },
    reset() {
      const c = cameraRef.current;
      if (c) {
        c.zoom = 1;
        zoomRef.current = 1;
        c.updateProjectionMatrix();
        controlsRef.current?.dispatchEvent({ type: "change" });
      }
    },
  }));

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFallback(true);
      return;
    }
    setFallback(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor("#11191e", 1);
    renderer.domElement.setAttribute(
      "aria-label",
      "Трёхмерная карта бизнес-модели. Выберите блок кнопкой с его названием.",
    );
    renderer.domElement.style.touchAction = "none";
    host.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#11191e", 24, 52);
    const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.1, 100);
    camera.position.set(13, 17, 19);
    camera.lookAt(0, 0, 0);
    camera.zoom = zoomRef.current;
    cameraRef.current = camera;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.minZoom = 0.35;
    controls.maxZoom = 2;
    controlsRef.current = controls;
    scene.add(new THREE.HemisphereLight("#deebee", "#334249", 3.2));
    const sun = new THREE.DirectionalLight("#e9f6e5", 4);
    sun.position.set(-4, 12, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: "#11191e", roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(60, 60, "#26363b", "#1d2b31");
    grid.position.y = -0.025;
    scene.add(grid);

    const groups = new Map<string, THREE.Group>();
    const targets: THREE.Object3D[] = [];
    const rings = new Map<string, THREE.Mesh>();
    for (const block of project.blocks) {
      const info = catalog[block.kind];
      const group = new THREE.Group();
      group.position.set(block.x, 0, block.z);
      const pedestal = tile(2.15, 0.12, "#253138");
      group.add(pedestal);
      const ring = tile(1.93, 0.04, info.color);
      ring.position.y = 0.14;
      group.add(ring);
      rings.set(block.id, ring);
      const base = tile(
        1.82,
        0.6,
        new THREE.Color(info.color).multiplyScalar(0.22),
      );
      base.position.y = 0.2;
      group.add(base);
      const cap = tile(
        1.82,
        0.12,
        new THREE.Color(info.color).multiplyScalar(0.65),
      );
      cap.position.y = 0.82;
      group.add(cap);
      const detail = tile(
        1.25,
        0.025,
        new THREE.Color(info.color).multiplyScalar(0.8),
      );
      detail.position.y = 0.98;
      group.add(detail);
      const iconCanvas = document.createElement("canvas");
      iconCanvas.width = 128;
      iconCanvas.height = 128;
      const ctx = iconCanvas.getContext("2d")!;
      const paths = {
        acquisition: "M3 17L9 11L13 15L21 5M14 5H21V12",
        audience:
          "M8 11A3 3 0 1 0 8 5A3 3 0 1 0 8 11M2 21V18Q2 14 8 14Q14 14 14 18V21M16 5A3 3 0 0 1 16 11M18 14Q22 14 22 18V21",
        product: "M12 3L22 8L12 13L2 8ZM2 8V17L12 22L22 17V8M12 13V22",
        revenue: "M12 2V22M18 6H9A4 4 0 0 0 9 14H15A3 3 0 0 1 15 20H6",
        agent: "M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5Z",
        finance: "M5 3H19V21H5ZM8 7H16M8 11H16M8 15H12M8 18H16",
        legal: "M12 3V21M5 21H19M3 7H21M6 7L2 15H10ZM18 7L14 15H22Z",
      };
      ctx.scale(128 / 28, 128 / 28);
      ctx.translate(2, 2);
      ctx.strokeStyle = "#172b24";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(new Path2D(paths[block.kind]));
      const texture = new THREE.CanvasTexture(iconCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const icon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 0.85),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        }),
      );
      icon.rotation.x = -Math.PI / 2;
      icon.position.y = 1.08;
      group.add(icon);
      // Small indicator lights make each module feel like a physical machine.
      for (let i = 0; i < 3; i++) {
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.06, 0.02),
          new THREE.MeshBasicMaterial({ color: info.color }),
        );
        light.position.set(-0.4 + i * 0.24, 0.48, 0.92);
        group.add(light);
      }
      group.traverse((o) => {
        o.userData.blockId = block.id;
        if (o instanceof THREE.Mesh) targets.push(o);
      });
      groups.set(block.id, group);
      scene.add(group);
    }
    selectionRef.current = rings;

    const paths: { curve: THREE.CatmullRomCurve3; bead: THREE.Mesh }[] = [];
    for (const edge of project.connections) {
      const from = project.blocks.find((b) => b.id === edge.from);
      const to = project.blocks.find((b) => b.id === edge.to);
      if (!from || !to) continue;
      const start = new THREE.Vector3(from.x, 0.2, from.z);
      const end = new THREE.Vector3(to.x, 0.2, to.z);
      const middle = start.clone().lerp(end, 0.5);
      middle.y = 0.28;
      const curve = new THREE.CatmullRomCurve3([start, middle, end]);
      const color = catalog[from.kind].color;
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 20, 0.026, 5, false),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }),
      );
      scene.add(tube);
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color }),
      );
      scene.add(bead);
      paths.push({ curve, bead });
      const arrow = new THREE.ArrowHelper(
        end.clone().sub(start).normalize(),
        curve.getPoint(0.62),
        0.32,
        color,
        0.25,
        0.18,
      );
      scene.add(arrow);
    }

    const projectLabels = () => {
      camera.updateMatrixWorld();
      const { width, height } = host.getBoundingClientRect();
      setLabels(
        [...groups].map(([id, group]) => {
          const v = new THREE.Vector3(
            group.position.x,
            1.5,
            group.position.z,
          ).project(camera);
          return {
            id,
            x: ((v.x + 1) * width) / 2,
            y: ((-v.y + 1) * height) / 2,
          };
        }),
      );
      zoomRef.current = camera.zoom;
    };
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      const extent = w < 550 ? 9 : 5.5;
      camera.left = (-extent * w) / h;
      camera.right = (extent * w) / h;
      camera.top = extent;
      camera.bottom = -extent;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      projectLabels();
    };
    controls.addEventListener("change", projectLabels);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let drag: {
      id: string;
      startX: number;
      startY: number;
      moved: boolean;
      offset: THREE.Vector3;
    } | null = null;
    function cast(event: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        (-(event.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      cast(event);
      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit) return;
      const id = hit.object.userData.blockId as string;
      const point = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, point);
      drag = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        offset: groups.get(id)!.position.clone().sub(point),
      };
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const move = (event: PointerEvent) => {
      cast(event);
      if (!drag) {
        renderer.domElement.style.cursor = raycaster.intersectObjects(
          targets,
          false,
        ).length
          ? "grab"
          : "default";
        return;
      }
      if (
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5
      )
        drag.moved = true;
      if (!drag.moved) return;
      const point = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, point);
      point.add(drag.offset);
      groups
        .get(drag.id)!
        .position.set(
          THREE.MathUtils.clamp(point.x, -10, 10),
          0,
          THREE.MathUtils.clamp(point.z, -10, 10),
        );
      projectLabels();
    };
    const up = (event: PointerEvent) => {
      if (!drag) return;
      const { id, moved } = drag;
      const pos = groups.get(id)!.position;
      drag = null;
      if (renderer.domElement.hasPointerCapture(event.pointerId))
        renderer.domElement.releasePointerCapture(event.pointerId);
      if (moved)
        callbacks.current.onMove(
          id,
          Math.round(pos.x * 2) / 2,
          Math.round(pos.z * 2) / 2,
        );
      else callbacks.current.onSelect(id);
      renderer.domElement.style.cursor = "default";
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    let frame = 0;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const render = (time: number) => {
      paths.forEach(({ curve, bead }, i) =>
        bead.position.copy(
          curve.getPoint(reduceMotion ? 0.5 : (time * 0.00012 + i * 0.17) % 1),
        ),
      );
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = mesh.material
          ? Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          : [];
        materials.forEach((m) => {
          if ("map" in m) (m.map as THREE.Texture | null)?.dispose();
          m.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [project.blocks, project.connections]);

  useEffect(() => {
    selectionRef.current.forEach((ring, id) => {
      const material = ring.material as THREE.MeshStandardMaterial;
      material.emissive.set(id === selected ? "#c6f77c" : "#000000");
      material.emissiveIntensity = id === selected ? 0.7 : 0;
      ring.scale.setScalar(id === selected ? 1.07 : 1);
    });
  }, [selected, project.blocks, project.connections]);

  return (
    <div
      className={`world ${connecting ? "world-connecting" : ""}`}
      ref={container}
      data-testid="world"
    >
      {fallback ? (
        <div className="world-fallback">
          <p>3D недоступно в этом браузере. Модель работает в режиме списка.</p>
          {project.blocks.map((b) => (
            <button key={b.id} onClick={() => onSelect(b.id)}>
              {catalog[b.kind].mark} {b.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="world-labels">
          {labels.map((label) => {
            const block = project.blocks.find((b) => b.id === label.id);
            if (!block) return null;
            return (
              <button
                key={label.id}
                style={
                  {
                    left: label.x,
                    top: label.y,
                    "--block-color": catalog[block.kind].color,
                  } as React.CSSProperties
                }
                className={`world-label ${selected === label.id ? "selected" : ""}`}
                onClick={() => onSelect(label.id)}
                aria-pressed={selected === label.id}
              >
                <span className="label-dot" />
                {block.name}
                <svg
                  className="label-arrow"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M7 17 17 7M7 7h10v10" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
