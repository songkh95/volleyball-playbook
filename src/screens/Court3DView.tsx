import { OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  forwardRef,
  Suspense,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { flushSync } from "react-dom";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ballPoseAtPlayhead, type BallPose } from "../lib/ballFlight";
import { playerActionPose } from "../lib/playerPose";
import {
  BALL_RADIUS,
  courtToWorld,
  getCameraPose,
  NET_BOTTOM,
  NET_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPLIT,
  shadeHex,
  netWorldZ,
  worldToCourt,
  type CameraCorner,
} from "../lib/court3d";
import { COURT_FILL } from "../design/tokens";
import { courtMeters } from "../lib/defaultPlay";
import { coverageRadius, defaultCoverageOn, isOpponent } from "../lib/inspect";
import { getConeSprite, loadConeSprite } from "../lib/coneSprite";
import { yieldToUi, EXPORT_WIDTH } from "../lib/exportMovie";
import { viewAtPlayhead, type Trail } from "../lib/interpolate";
import type { CourtObject, CourtType, Cut, PlayerPose, Stroke, ZoneMode } from "../types/play";
import { zoneCells } from "../lib/zones";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

type ThreeApi = {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
};

export type Court3DHandle = {
  toPngBlob: () => Promise<Blob>;
  captureViews: (playheads: number[], maxWidth?: number) => Promise<ImageData[]>;
};

type Props = {
  court: CourtType;
  objects: CourtObject[];
  cuts: Cut[];
  playhead: number;
  trails: Trail[];
  strokes: Stroke[];
  showTrails: boolean;
  showCoverage?: boolean;
  holeAlpha?: number;
  zoneMode?: ZoneMode;
  cameraPreset: CameraCorner;
  cameraNonce: number;
  interactive?: boolean;
  placingId?: string | null;
  onMove?: (id: string, x: number, y: number) => void;
  onMoveBegin?: () => void;
  onSelectPlayer?: (id: string) => void;
  onPlacePlayer?: (id: string) => void;
  onPointerStart?: () => void;
};

export const Court3DView = forwardRef<Court3DHandle, Props>(function Court3DView(
  props,
  ref,
) {
  const apiRef = useRef<ThreeApi | null>(null);
  const exportHeadRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  const exportHead = exportHeadRef.current;
  const snap = exportHead == null ? null : viewAtPlayhead(props.cuts, exportHead);
  const sceneProps: Props =
    snap && exportHead != null
      ? {
          ...props,
          playhead: exportHead,
          objects: snap.objects,
          trails: props.showTrails ? snap.trails : [],
          strokes: snap.strokes,
        }
      : props;

  useImperativeHandle(ref, () => ({
    toPngBlob: () => grabPng(apiRef.current),
    async captureViews(playheads, maxWidth = EXPORT_WIDTH) {
      const frames: ImageData[] = [];
      try {
        for (let i = 0; i < playheads.length; i++) {
          exportHeadRef.current = playheads[i];
          flushSync(() => setTick((n) => n + 1));
          await waitFrames(i === 0 ? 4 : 2);
          frames.push(grabFrame(apiRef.current, maxWidth));
          if (i % 2 === 1) await yieldToUi();
        }
      } finally {
        exportHeadRef.current = null;
        flushSync(() => setTick((n) => n + 1));
      }
      return frames;
    },
  }));

  const pose = getCameraPose(props.cameraPreset, props.court);

  return (
    <div
      className="absolute inset-0"
      style={{ background: "#5d6774" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        className="absolute inset-0 h-full w-full touch-none"
        style={{ width: "100%", height: "100%", display: "block" }}
        resize={{ debounce: 0, scroll: false }}
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 1.5]}
        camera={{
          fov: 40,
          near: 0.2,
          far: 120,
          position: [pose.position.x, pose.position.y, pose.position.z],
        }}
        onCreated={({ gl, scene, camera, size }) => {
          gl.setClearColor("#5d6774", 1);
          scene.background = new THREE.Color("#5d6774");
          if (size.width > 8 && size.height > 8) gl.setSize(size.width, size.height, false);
          camera.up.set(0, 1, 0);
          camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
          gl.render(scene, camera);
        }}
      >
        <CaptureBridge apiRef={apiRef} />
        <Scene {...sceneProps} />
      </Canvas>
    </div>
  );
});

function CaptureBridge({ apiRef }: { apiRef: MutableRefObject<ThreeApi | null> }) {
  const { gl, scene, camera, invalidate } = useThree();
  apiRef.current = { gl, scene, camera };
  useLayoutEffect(() => {
    gl.setClearColor("#5d6774", 1);
    invalidate();
  }, [gl, invalidate]);
  return null;
}

function grabPng(api: ThreeApi | null) {
  return new Promise<Blob>((resolve, reject) => {
    if (!api) {
      reject(new Error("3D 코트를 캡처할 수 없습니다."));
      return;
    }
    api.gl.render(api.scene, api.camera);
    api.gl.domElement.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("3D 코트를 캡처할 수 없습니다."));
    }, "image/png");
  });
}

function grabFrame(api: ThreeApi | null, maxWidth = EXPORT_WIDTH) {
  if (!api) throw new Error("3D 코트를 캡처할 수 없습니다.");
  api.gl.render(api.scene, api.camera);
  const src = api.gl.domElement;
  if (src.width < 8 || src.height < 8) {
    throw new Error("3D 코트를 캡처할 수 없습니다.");
  }
  const scale = Math.min(1, maxWidth / src.width);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("3D 코트를 캡처할 수 없습니다.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#5d6774";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function waitFrames(count: number) {
  return new Promise<void>((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => step(left - 1));
        return;
      }
      window.setTimeout(() => step(left - 1), 16);
    };
    step(count);
  });
}

function Scene(props: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const dragBegan = useRef(false);
  const longPressRef = useRef(0);
  const ball = useMemo(
    () => ballPoseAtPlayhead(props.cuts, props.playhead, props.court),
    [props.cuts, props.playhead, props.court],
  );
  const interactive = Boolean(props.interactive);
  const ballObj = props.objects.find((o) => o.kind === "ball");
  const placingId = props.placingId ?? null;
  const placing = Boolean(placingId);
  const focusPlayer = placingId
    ? props.objects.find((o) => o.id === placingId && o.kind === "player")
    : undefined;
  const focusWorld = focusPlayer
    ? courtToWorld(focusPlayer.x, focusPlayer.y, props.court)
    : null;

  useEffect(() => {
    return () => {
      if (longPressRef.current) window.clearTimeout(longPressRef.current);
    };
  }, []);

  function clearLongPress() {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = 0;
    }
  }

  function beginDrag(id: string) {
    if (placingId && id !== placingId) return;
    props.onPointerStart?.();
    dragBegan.current = false;
    setDragId(id);
  }

  function armPlace(id: string, pointerType: string) {
    clearLongPress();
    if (placingId || (pointerType !== "touch" && pointerType !== "pen")) return;
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = 0;
      props.onPlacePlayer?.(id);
    }, 500);
  }

  function moveDrag(id: string, x: number, y: number) {
    clearLongPress();
    if (!dragBegan.current) {
      dragBegan.current = true;
      props.onMoveBegin?.();
    }
    props.onMove?.(id, x, y);
  }

  return (
    <>
      <color attach="background" args={["#5d6774"]} />
      <hemisphereLight args={["#f2f4f8", "#8a7a62", placing ? 0.28 : 1.05]} />
      <ambientLight intensity={placing ? 0.18 : 0.72} />
      <directionalLight position={[8, 18, 10]} intensity={placing ? 0.32 : 1.75} />
      <directionalLight position={[-10, 8, -6]} intensity={placing ? 0.12 : 0.55} />
      {focusWorld ? (
        <pointLight
          position={[focusWorld.x, 2.6, focusWorld.z]}
          intensity={2.6}
          distance={5.5}
          color="#ffffff"
        />
      ) : null}
      <Gym court={props.court} />
      <CourtSurface court={props.court} />
      {placing ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
          renderOrder={8}
          raycast={() => {}}
        >
          <planeGeometry args={[48, 48]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.52} depthWrite={false} />
        </mesh>
      ) : null}
      <CourtLines court={props.court} />
      <ZoneGuides court={props.court} mode={props.zoneMode ?? "none"} />
      <Net court={props.court} />
      {props.showCoverage && !placing
        ? props.objects
            .filter((o) => o.kind === "player" && defaultCoverageOn(o))
            .map((o) => (
              <CoverageDisk key={`cov-${o.id}`} obj={o} court={props.court} />
            ))
        : null}
      {props.objects
        .filter((o) => o.kind === "ball" && o.fan)
        .map((o) => (
          <LandingSector key={`fan-${o.id}`} ball={o} court={props.court} />
        ))}
      {props.holeAlpha
        ? (
            <CoverageHoles
              objects={props.objects}
              court={props.court}
              alpha={props.holeAlpha}
            />
          )
        : null}
      {props.objects
        .filter((o) => o.kind === "player")
        .map((o) => (
          <group
            key={o.id}
            onPointerDown={(e) => {
              if (!interactive) return;
              if (placingId && o.id !== placingId) return;
              e.stopPropagation();
              armPlace(o.id, e.nativeEvent.pointerType);
              beginDrag(o.id);
            }}
            onPointerUp={clearLongPress}
            onPointerCancel={clearLongPress}
            onContextMenu={(e) => {
              e.stopPropagation();
              e.nativeEvent.preventDefault();
              if (!interactive || placingId) return;
              props.onPlacePlayer?.(o.id);
            }}
          >
            <PlayerFigure
              obj={o}
              court={props.court}
              highlight={
                ball?.playerId === o.id && ball.zone !== "air" ? ball.zone : null
              }
              action={playerActionPose(props.cuts, props.playhead, o.id) ?? "idle"}
              dimmed={placing && o.id !== placingId}
            />
          </group>
        ))}
      {props.objects
        .filter((o) => o.kind === "cone")
        .map((o) => (
          <group
            key={o.id}
            onPointerDown={(e) => {
              if (!interactive || placing) return;
              e.stopPropagation();
              beginDrag(o.id);
            }}
          >
            <TrafficCone obj={o} court={props.court} />
          </group>
        ))}
      {props.objects
        .filter((o) => o.kind === "text")
        .map((o) => (
          <group
            key={o.id}
            onPointerDown={(e) => {
              if (!interactive || placing) return;
              e.stopPropagation();
              beginDrag(o.id);
            }}
          >
            <BoardText obj={o} court={props.court} />
          </group>
        ))}
      {ball ? (
        <group
            onPointerDown={(e) => {
              if (!interactive || !ballObj || placing) return;
              e.stopPropagation();
              beginDrag(ballObj.id);
            }}
        >
          <Ball pose={ball} court={props.court} />
        </group>
      ) : null}
      <BallArc cuts={props.cuts} playhead={props.playhead} court={props.court} />
      {props.showTrails
        ? props.trails.map((trail, i) => (
            <FloorTrail key={`t-${i}`} trail={trail} court={props.court} />
          ))
        : null}
      {props.strokes.map((stroke) => (
        <FloorStroke key={stroke.id} stroke={stroke} court={props.court} />
      ))}
      <ViewControls
        preset={props.cameraPreset}
        court={props.court}
        nonce={props.cameraNonce}
        enableRotate={!dragId && !placing}
      />
      {dragId ? (
        <DragFloor
          court={props.court}
          dragId={dragId}
          onMove={moveDrag}
          onUp={() => {
            clearLongPress();
            setDragId(null);
          }}
        />
      ) : null}
    </>
  );
}

function DragFloor({
  court,
  dragId,
  onMove,
  onUp,
}: {
  court: CourtType;
  dragId: string;
  onMove: (id: string, x: number, y: number) => void;
  onUp: () => void;
}) {
  const { width, length } = courtMeters(court);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      onPointerMove={(e) => {
        e.stopPropagation();
        const n = worldToCourt(e.point.x, e.point.z, court);
        onMove(
          dragId,
          Math.min(0.97, Math.max(0.03, n.x)),
          Math.min(0.97, Math.max(0.03, n.y)),
        );
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onUp();
      }}
      onPointerLeave={onUp}
    >
      <planeGeometry args={[width * 1.8, length * 1.8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function ViewControls({
  preset,
  court,
  nonce,
  enableRotate = true,
}: {
  preset: CameraCorner;
  court: CourtType;
  nonce: number;
  enableRotate?: boolean;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const pose = getCameraPose(preset, court);
  const { camera, invalidate } = useThree();
  const poseKey = `${preset}:${court}:${nonce}`;
  const appliedKey = useRef("");

  const applyPose = () => {
    const c = controlsRef.current;
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    if (c) {
      c.object.position.copy(camera.position);
      c.target.set(pose.target.x, pose.target.y, pose.target.z);
      c.update();
    }
    invalidate();
  };

  useLayoutEffect(() => {
    appliedKey.current = "";
    applyPose();
    const id = requestAnimationFrame(applyPose);
    return () => cancelAnimationFrame(id);
  }, [preset, court, nonce, pose.position.x, pose.position.y, pose.position.z, pose.target.x, pose.target.y, pose.target.z]);

  useFrame(() => {
    if (appliedKey.current === poseKey) return;
    applyPose();
    if (controlsRef.current) appliedKey.current = poseKey;
  });

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={40}
        near={0.2}
        far={120}
        position={[pose.position.x, pose.position.y, pose.position.z]}
      />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        enableRotate={enableRotate}
        minDistance={8}
        maxDistance={40}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI / 2 - 0.12}
        target={[pose.target.x, pose.target.y, pose.target.z]}
        rotateSpeed={0.72}
        zoomSpeed={0.85}
      />
    </>
  );
}

function Gym({ court }: { court: CourtType }) {
  const { width, length } = courtMeters(court);
  const floorW = 38;
  const floorL = 52;
  const wallH = 11;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[floorW, floorL]} />
        <meshStandardMaterial color="#3e2f1c" roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[0, wallH / 2, -floorL / 2]}>
        <planeGeometry args={[floorW, wallH]} />
        <meshStandardMaterial color="#6b7686" />
      </mesh>
      <mesh position={[0, wallH / 2, floorL / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[floorW, wallH]} />
        <meshStandardMaterial color="#6b7686" />
      </mesh>
      <mesh position={[-floorW / 2, wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[floorL, wallH]} />
        <meshStandardMaterial color="#616b7a" />
      </mesh>
      <mesh position={[floorW / 2, wallH / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[floorL, wallH]} />
        <meshStandardMaterial color="#616b7a" />
      </mesh>
      <mesh position={[0, wallH, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[floorW, floorL]} />
        <meshStandardMaterial color="#8b95a3" />
      </mesh>
      {([1, -1] as const).map((side) =>
        [0, 1, 2, 3].map((step) => (
          <mesh
            key={`${side}-${step}`}
            position={[
              side * (width / 2 + 6.2 + step * 0.55),
              0.22 + step * 0.34,
              0,
            ]}
            receiveShadow
          >
            <boxGeometry args={[0.5, 0.44 + step * 0.08, length + 5]} />
            <meshStandardMaterial color={step % 2 === 0 ? "#3b465c" : "#323c50"} />
          </mesh>
        )),
      )}
    </group>
  );
}

function CoverageDisk({ obj, court }: { obj: CourtObject; court: CourtType }) {
  const { x, z } = courtToWorld(obj.x, obj.y, court);
  const r = coverageRadius(obj);
  return (
    <mesh position={[x, 0.022, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[r, 48]} />
      <meshBasicMaterial
        color={obj.color}
        transparent
        opacity={0.28}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function LandingSector({ ball, court }: { ball: CourtObject; court: CourtType }) {
  const fan = ball.fan;
  const { x, z } = courtToWorld(ball.x, ball.y, court);
  if (!fan) return null;
  const thetaStart = Math.PI / 2 - fan.heading - fan.spread / 2;
  return (
    <mesh position={[x, 0.024, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[fan.depth, 48, thetaStart, fan.spread]} />
      <meshBasicMaterial
        color="#ffd54f"
        transparent
        opacity={0.28}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CoverageHoles({
  objects,
  court,
  alpha,
}: {
  objects: CourtObject[];
  court: CourtType;
  alpha: number;
}) {
  const geom = useMemo(() => {
    const { width, length } = courtMeters(court);
    const hw = width / 2;
    const hl = length / 2;
    const ourEndY = -hl;
    const netY = -netWorldZ(court);
    const shape = new THREE.Shape();
    shape.moveTo(-hw, ourEndY);
    shape.lineTo(hw, ourEndY);
    shape.lineTo(hw, netY);
    shape.lineTo(-hw, netY);
    shape.closePath();
    for (const o of objects) {
      if (o.kind !== "player" || !defaultCoverageOn(o)) continue;
      const { x, z } = courtToWorld(o.x, o.y, court);
      const r = coverageRadius(o);
      const hole = new THREE.Path();
      hole.absellipse(x, -z, r, r, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return new THREE.ShapeGeometry(shape);
  }, [objects, court]);

  useEffect(() => () => geom.dispose(), [geom]);
  if (alpha <= 0) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={geom}>
      <meshBasicMaterial
        color="#c6c8d2"
        transparent
        opacity={alpha}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CourtSurface({ court }: { court: CourtType }) {
  const { width, length } = courtMeters(court);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[width, length]} />
      <meshBasicMaterial color={COURT_FILL} />
    </mesh>
  );
}

function ZoneGuides({ court, mode }: { court: CourtType; mode: ZoneMode }) {
  const { width, length } = courtMeters(court);
  const cells = useMemo(() => zoneCells(mode, court), [mode, court]);
  const textures = useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>();
    for (const cell of cells) {
      if (!map.has(cell.label)) map.set(cell.label, makeZoneNumTexture(cell.label));
    }
    return map;
  }, [cells]);

  useEffect(
    () => () => {
      for (const tex of textures.values()) tex.dispose();
    },
    [textures],
  );

  if (cells.length === 0) return null;
  const yLine = 0.02;
  const yNum = 0.03;
  return (
    <group>
      {cells.map((cell) => {
        const a = courtToWorld(cell.x0, cell.y0, court);
        const b = courtToWorld(cell.x1, cell.y0, court);
        const c = courtToWorld(cell.x1, cell.y1, court);
        const d = courtToWorld(cell.x0, cell.y1, court);
        const mid = courtToWorld((cell.x0 + cell.x1) / 2, (cell.y0 + cell.y1) / 2, court);
        const cw = Math.abs(cell.x1 - cell.x0) * width;
        const ch = Math.abs(cell.y1 - cell.y0) * length;
        const size = Math.min(cw, ch) * 0.42;
        const tex = textures.get(cell.label);
        return (
          <group key={`${cell.label}-${cell.x0}-${cell.y0}`}>
            <LineSegment a={[a.x, yLine, a.z]} b={[b.x, yLine, b.z]} color="#fff4e4" width={0.03} />
            <LineSegment a={[b.x, yLine, b.z]} b={[c.x, yLine, c.z]} color="#fff4e4" width={0.03} />
            <LineSegment a={[c.x, yLine, c.z]} b={[d.x, yLine, d.z]} color="#fff4e4" width={0.03} />
            <LineSegment a={[d.x, yLine, d.z]} b={[a.x, yLine, a.z]} color="#fff4e4" width={0.03} />
            {tex ? (
              <mesh position={[mid.x, yNum, mid.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[size, size]} />
                <meshBasicMaterial
                  map={tex}
                  transparent
                  opacity={0.55}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function CourtLines({ court }: { court: CourtType }) {
  const { width, length } = courtMeters(court);
  const hw = width / 2;
  const hl = length / 2;
  const y = 0.015;
  const netZ = netWorldZ(court);
  const attackOurs = hl - 6;
  const attackOpp = court === "full" ? hl - 12 : null;
  const segs: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
    [
      [-hw, y, -hl],
      [hw, y, -hl],
    ],
    [
      [-hw, y, hl],
      [hw, y, hl],
    ],
    [
      [-hw, y, -hl],
      [-hw, y, hl],
    ],
    [
      [hw, y, -hl],
      [hw, y, hl],
    ],
    [
      [-hw, y, netZ],
      [hw, y, netZ],
    ],
    [
      [-hw, y, attackOurs],
      [hw, y, attackOurs],
    ],
  ];
  if (attackOpp !== null) {
    segs.push([
      [-hw, y, attackOpp],
      [hw, y, attackOpp],
    ]);
  }
  return (
    <group>
      {segs.map(([a, b], i) => (
        <LineSegment key={i} a={a} b={b} color="#ffffff" />
      ))}
    </group>
  );
}

function LineSegment({
  a,
  b,
  color,
  width = 0.045,
}: {
  a: THREE.Vector3Tuple;
  b: THREE.Vector3Tuple;
  color: string;
  width?: number;
}) {
  const { geom, pos, rotY, len } = useMemo(() => {
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dz);
    return {
      geom: true as const,
      pos: [(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2] as THREE.Vector3Tuple,
      rotY: Math.atan2(dx, dz),
      len,
    };
  }, [a, b]);
  if (!geom || len < 1e-4) return null;
  return (
    <mesh position={pos} rotation={[0, rotY, 0]}>
      <boxGeometry args={[width, 0.012, len]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function SpaceSegment({
  a,
  b,
  color,
  width = 0.03,
}: {
  a: THREE.Vector3Tuple;
  b: THREE.Vector3Tuple;
  color: string;
  width?: number;
}) {
  const { pos, quat, len } = useMemo(() => {
    const start = new THREE.Vector3(a[0], a[1], a[2]);
    const end = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = end.clone().sub(start);
    const len = dir.length();
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const quat = new THREE.Quaternion();
    if (len > 1e-6) {
      quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.multiplyScalar(1 / len));
    }
    return { pos: mid.toArray() as THREE.Vector3Tuple, quat, len };
  }, [a, b]);
  if (len < 1e-4) return null;
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[width / 2, width / 2, len, 5]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </mesh>
  );
}

function NetFallback({ court }: { court: CourtType }) {
  const { width } = courtMeters(court);
  const netH = NET_HEIGHT - NET_BOTTOM;
  return (
    <group>
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, NET_HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, NET_HEIGHT, 8]} />
          <meshStandardMaterial color="#ececec" metalness={0.35} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, NET_HEIGHT - 0.03, 0]}>
        <boxGeometry args={[width, 0.07, 0.05]} />
        <meshStandardMaterial color="#f4f4f4" />
      </mesh>
      <mesh position={[0, NET_BOTTOM + netH / 2, 0]}>
        <boxGeometry args={[width, netH, 0.02]} />
        <meshStandardMaterial color="#111111" transparent opacity={0.52} />
      </mesh>
    </group>
  );
}

const NET_GLB = "/models/volleyball_net.glb";
const NET_TARGET_WIDTH = 9.5;

function NetModel() {
  const { scene } = useGLTF(NET_GLB);
  const wrapper = useMemo(() => {
    const clone = scene.clone(true);
    const drop: THREE.Object3D[] = [];
    clone.traverse((obj) => {
      if (
        obj.name === "Light" ||
        obj.name === "Camera" ||
        obj.type.includes("Light") ||
        obj.type.includes("Camera")
      ) {
        drop.push(obj);
      }
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m) m.side = THREE.DoubleSide;
        }
      }
    });
    for (const obj of drop) obj.removeFromParent();
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3();
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox;
      if (!b) return;
      box.union(b.clone().applyMatrix4(mesh.matrixWorld));
    });
    if (box.isEmpty()) box.setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const inner = new THREE.Group();
    inner.add(clone);
    inner.position.set(-center.x, -box.min.y, -center.z);
    const group = new THREE.Group();
    group.add(inner);
    const sx = NET_TARGET_WIDTH / Math.max(size.x, 1e-6);
    const sy = NET_HEIGHT / Math.max(size.y, 1e-6);
    group.scale.set(sx, sy, sx);
    return group;
  }, [scene]);
  return <primitive object={wrapper} />;
}

useGLTF.preload(NET_GLB);

function Net({ court }: { court: CourtType }) {
  const z = netWorldZ(court);
  return (
    <group position={[0, 0, z]}>
      <Suspense fallback={<NetFallback court={court} />}>
        <NetModel />
      </Suspense>
    </group>
  );
}

function TrafficCone({ obj, court }: { obj: CourtObject; court: CourtType }) {
  const { x, z } = courtToWorld(obj.x, obj.y, court);
  const [, setReady] = useState(0);
  useEffect(() => {
    loadConeSprite(() => setReady((n) => n + 1));
  }, []);
  const canvas = getConeSprite(obj.color);
  const texture = useMemo(() => {
    if (!canvas) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [canvas, obj.color]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const aspect = canvas ? canvas.width / Math.max(1, canvas.height) : 0.72;
  const h = 0.3;
  const w = h * aspect;
  if (!texture) {
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.13, 0]} castShadow>
          <coneGeometry args={[0.085, 0.26, 16]} />
          <meshStandardMaterial color={obj.color} roughness={0.55} />
        </mesh>
      </group>
    );
  }
  return (
    <sprite position={[x, h / 2, z]} scale={[w, h, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function BoardText({ obj, court }: { obj: CourtObject; court: CourtType }) {
  const { x, z } = courtToWorld(obj.x, obj.y, court);
  const label = obj.label || "텍스트";
  const size = obj.fontSize ?? 18;
  const texture = useMemo(
    () => makeBoardTextTexture(label, obj.color, Boolean(obj.bold), Boolean(obj.italic)),
    [label, obj.color, obj.bold, obj.italic],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  const w = Math.max(0.9, (label.length * 0.22 + 0.4) * (size / 18));
  const h = 0.42 * (size / 18);
  return (
    <sprite position={[x, 0.28, z]} scale={[w, h, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function PlayerLabel({
  label,
  color,
  y,
}: {
  label: string;
  color: string;
  y: number;
}) {
  const texture = useMemo(() => makeLabelTexture(label.slice(0, 4), color), [label, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[0, y, 0]} scale={[0.95, 0.38, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

const SPIKE_GLB = "/models/player-spike.glb";
const RECEIVE_GLB = "/models/player-receive.glb";
const SET_GLB = "/models/player-set.glb";
const IDLE_GLB = "/models/player-idle.glb";
const BLOCK_GLB = "/models/player-block.glb";
const POSE_GLB: Record<PlayerPose, string> = {
  idle: IDLE_GLB,
  receive: RECEIVE_GLB,
  set: SET_GLB,
  spike: SPIKE_GLB,
  block: BLOCK_GLB,
};
/** Mixamo는 +Z가 앞. 우리 엔드가 +Z라서 우리 선수는 네트(-Z)를 보게 π. */
const SPIKE_FACE_OURS = Math.PI;
const SPIKE_FACE_OPP = 0;
const POSE_LABEL_Y: Record<PlayerPose, number> = {
  idle: 2.08,
  receive: 1.58,
  set: 2.58,
  spike: 2.42,
  block: 2.92,
};
/** 물리 반경은 그대로 두고, 3D 공만 절반 크기로 그린다. */
const BALL_VISUAL_RADIUS = BALL_RADIUS * 0.5;

function applyPlayerTint(root: THREE.Object3D, color: string) {
  root.traverse((obj) => {
    const name = obj.name.toLowerCase();
    if (
      obj.type.includes("Light") ||
      obj.type.includes("Camera") ||
      name.includes("ico") ||
      name === "sphere"
    ) {
      obj.visible = false;
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = src.map((m) => {
      const mat = (m as THREE.MeshStandardMaterial).clone();
      const matName = (m?.name ?? "").toLowerCase();
      if (matName.includes("jersey") || matName.includes("body")) {
        mat.color = new THREE.Color(color);
      } else if (matName.includes("shorts") || matName.includes("joint")) {
        mat.color = new THREE.Color(shadeHex(color, -0.32));
      }
      return mat;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

function PlayerPoseModel({ url, color }: { url: string; color: string }) {
  const { scene } = useGLTF(url);
  const root = useMemo(() => {
    const cloned = cloneSkinned(scene);
    applyPlayerTint(cloned, color);
    return cloned;
  }, [scene, color]);
  return <primitive object={root} />;
}

useGLTF.preload(SPIKE_GLB);
useGLTF.preload(RECEIVE_GLB);
useGLTF.preload(SET_GLB);
useGLTF.preload(IDLE_GLB);
useGLTF.preload(BLOCK_GLB);

function PlayerFigure({
  obj,
  court,
  highlight,
  action,
  dimmed = false,
}: {
  obj: CourtObject;
  court: CourtType;
  highlight: "upper" | "lower" | null;
  action: PlayerPose;
  dimmed?: boolean;
}) {
  const { x, z } = courtToWorld(obj.x, obj.y, court);
  const yaw = isOpponent(obj) ? SPIKE_FACE_OPP : SPIKE_FACE_OURS;
  const tint = dimmed ? shadeHex(obj.color, -0.72) : obj.color;
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <Suspense
        fallback={
          <PlayerCylinderBody obj={{ ...obj, color: tint }} highlight={dimmed ? null : highlight} />
        }
      >
        <PlayerPoseModel url={POSE_GLB[action]} color={tint} />
      </Suspense>
      <PlayerLabel label={obj.label} color={tint} y={POSE_LABEL_Y[action]} />
    </group>
  );
}

function PlayerCylinderBody({
  obj,
  highlight,
}: {
  obj: CourtObject;
  highlight: "upper" | "lower" | null;
}) {
  const lowerH = PLAYER_SPLIT;
  const upperH = PLAYER_HEIGHT - PLAYER_SPLIT;
  const lowerColor = shadeHex(obj.color, -0.32);
  const upperColor = shadeHex(obj.color, 0.1);
  return (
    <group>
      <mesh position={[0, lowerH / 2, 0]} castShadow>
        <cylinderGeometry args={[PLAYER_RADIUS, PLAYER_RADIUS, lowerH, 18]} />
        <meshStandardMaterial
          color={lowerColor}
          roughness={0.55}
          emissive={highlight === "lower" ? "#fff3c4" : "#000000"}
          emissiveIntensity={highlight === "lower" ? 0.35 : 0}
        />
      </mesh>
      <mesh position={[0, lowerH + upperH / 2, 0]} castShadow>
        <cylinderGeometry args={[PLAYER_RADIUS, PLAYER_RADIUS, upperH, 18]} />
        <meshStandardMaterial
          color={upperColor}
          roughness={0.5}
          emissive={highlight === "upper" ? "#fff3c4" : "#000000"}
          emissiveIntensity={highlight === "upper" ? 0.35 : 0}
        />
      </mesh>
      <mesh position={[0, PLAYER_SPLIT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[PLAYER_RADIUS * 0.82, PLAYER_RADIUS + 0.012, 24]} />
        <meshBasicMaterial color="#0b0b0b" />
      </mesh>
    </group>
  );
}

function VolleyballModel() {
  const { scene } = useGLTF("/models/volleyball.glb");
  const { clone, scale } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    return { clone, scale: (BALL_VISUAL_RADIUS * 2) / maxDim };
  }, [scene]);
  return <primitive object={clone} scale={scale} />;
}

useGLTF.preload("/models/volleyball.glb");

function Ball({
  pose,
  court,
}: {
  pose: BallPose;
  court: CourtType;
}) {
  const world = courtToWorld(pose.x, pose.y, court);
  const height = Math.max(BALL_RADIUS, pose.height);
  return (
    <group position={[world.x, 0, world.z]}>
      <mesh position={[0, Math.max(0.04, height / 2), 0]}>
        <cylinderGeometry args={[0.018, 0.018, height, 8]} />
        <meshBasicMaterial color="#ffd54f" transparent opacity={0.35} />
      </mesh>
      <group position={[0, height, 0]}>
        <Suspense
          fallback={
            <mesh castShadow>
              <sphereGeometry args={[BALL_VISUAL_RADIUS, 24, 16]} />
              <meshStandardMaterial color="#ffd54f" roughness={0.32} metalness={0.08} />
            </mesh>
          }
        >
          <VolleyballModel />
        </Suspense>
      </group>
    </group>
  );
}

function BallArc({
  cuts,
  playhead,
  court,
}: {
  cuts: Cut[];
  playhead: number;
  court: CourtType;
}) {
  const pts = useMemo(() => {
    if (cuts.length < 2) return [];
    const last = cuts.length - 1;
    const p = Math.min(last, Math.max(0, playhead));
    const i = Math.min(last - 1, Math.floor(p));
    const t = p - i;
    if (t < 0.02 || t > 0.98) return [];
    const fromBall = cuts[i]?.objects.find((o) => o.kind === "ball");
    const toBall = cuts[i + 1]?.objects.find((o) => o.kind === "ball");
    const flight = fromBall?.flight ?? toBall?.flight;
    if (flight !== "slow") return [];
    if (fromBall && toBall && Math.hypot(toBall.x - fromBall.x, toBall.y - fromBall.y) < 0.012) {
      return [];
    }
    const out: THREE.Vector3Tuple[] = [];
    for (let s = 0; s <= 18; s++) {
      const pose = ballPoseAtPlayhead(cuts, i + s / 18, court);
      if (!pose) continue;
      const w = courtToWorld(pose.x, pose.y, court);
      out.push([w.x, Math.max(BALL_RADIUS, pose.height), w.z]);
    }
    return out;
  }, [cuts, playhead, court]);

  if (pts.length < 2) return null;
  return (
    <group>
      {pts.slice(0, -1).map((a, i) => (
        <SpaceSegment key={i} a={a} b={pts[i + 1]} color="#ffd54f" width={0.045} />
      ))}
    </group>
  );
}

function FloorTrail({ trail, court }: { trail: Trail; court: CourtType }) {
  const a = courtToWorld(trail.x1, trail.y1, court);
  const b = courtToWorld(trail.x2, trail.y2, court);
  return (
    <LineSegment
      a={[a.x, 0.03, a.z]}
      b={[b.x, 0.03, b.z]}
      color={trail.kind === "ball" ? "#ffd54f" : trail.color || "#ffffff"}
      width={0.035}
    />
  );
}

function FloorStroke({ stroke, court }: { stroke: Stroke; court: CourtType }) {
  if (stroke.points.length < 2) return null;
  const pts = stroke.points.map((p) => courtToWorld(p.x, p.y, court));
  return (
    <group>
      {pts.slice(0, -1).map((p, i) => (
        <LineSegment
          key={i}
          a={[p.x, 0.025, p.z]}
          b={[pts[i + 1].x, 0.025, pts[i + 1].z]}
          color={stroke.color}
          width={0.04}
        />
      ))}
    </group>
  );
}

function makeLabelTexture(text: string, color: string, wide = false) {
  const canvas = document.createElement("canvas");
  const w = wide ? 384 : 256;
  canvas.width = w;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, w, 96);
    const r = 18;
    const right = w - 8;
    ctx.fillStyle = "rgba(12,12,20,0.78)";
    ctx.beginPath();
    ctx.moveTo(r, 8);
    ctx.arcTo(right, 8, right, 88, r);
    ctx.arcTo(right, 88, 8, 88, r);
    ctx.arcTo(8, 88, 8, 8, r);
    ctx.arcTo(8, 8, right, 8, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#f4f4f8";
    ctx.font = `700 ${wide ? 34 : 42}px Pretendard, Apple SD Gothic Neo, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text || "·", w / 2, 50);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeZoneNumTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "700 176px Pretendard, Apple SD Gothic Neo, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 138);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeBoardTextTexture(text: string, color: string, bold: boolean, italic: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${italic ? "italic " : ""}${bold ? 700 : 500} 92px Pretendard, Apple SD Gothic Neo, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text || "·", 384, 100);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
