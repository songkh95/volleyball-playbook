import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BallPose, MannequinPose } from "../lib/ballFlight";
import { courtToWorld, PLAYER_HEIGHT, shadeHex } from "../lib/court3d";
import { HAIR, SHOE, SKIN } from "../design/tokens";
import { isOpponent } from "../lib/inspect";
import type { CourtObject, CourtType } from "../types/play";

type Limb = {
  x?: number;
  y?: number;
  z?: number;
};

type PoseSet = {
  lift: number;
  hip: Limb;
  torso: Limb;
  lArm: Limb;
  rArm: Limb;
  lFore: Limb;
  rFore: Limb;
  lThigh: Limb;
  rThigh: Limb;
  lShin: Limb;
  rShin: Limb;
};

const POSES: Record<MannequinPose, PoseSet> = {
  idle: {
    lift: 0,
    hip: { x: 0.08 },
    torso: { x: 0.06 },
    lArm: { x: 0.28, z: 0.18 },
    rArm: { x: 0.28, z: -0.18 },
    lFore: { x: 0.35 },
    rFore: { x: 0.35 },
    lThigh: { x: 0.18, z: 0.06 },
    rThigh: { x: 0.18, z: -0.06 },
    lShin: { x: -0.28 },
    rShin: { x: -0.28 },
  },
  receive: {
    lift: -0.12,
    hip: { x: 0.55 },
    torso: { x: 0.35 },
    lArm: { x: 1.05, z: 0.35 },
    rArm: { x: 1.05, z: -0.35 },
    lFore: { x: 0.15 },
    rFore: { x: 0.15 },
    lThigh: { x: 0.95, z: 0.12 },
    rThigh: { x: 0.95, z: -0.12 },
    lShin: { x: -1.15 },
    rShin: { x: -1.15 },
  },
  set: {
    lift: 0,
    hip: { x: 0.18 },
    torso: { x: -0.08 },
    lArm: { x: -2.45, z: 0.12 },
    rArm: { x: -2.45, z: -0.12 },
    lFore: { x: -0.55 },
    rFore: { x: -0.55 },
    lThigh: { x: 0.42, z: 0.08 },
    rThigh: { x: 0.42, z: -0.08 },
    lShin: { x: -0.62 },
    rShin: { x: -0.62 },
  },
  spike: {
    lift: 0.52,
    hip: { x: -0.12 },
    torso: { x: -0.28, z: 0.12 },
    lArm: { x: 0.55, z: 0.45 },
    rArm: { x: -2.7, z: -0.35 },
    lFore: { x: 0.4 },
    rFore: { x: -0.35 },
    lThigh: { x: -0.55 },
    rThigh: { x: 0.55 },
    lShin: { x: -0.35 },
    rShin: { x: -0.85 },
  },
};

type Props = {
  obj: CourtObject;
  court: CourtType;
  pose: MannequinPose;
  highlight: "upper" | "lower" | null;
  ball: BallPose | null;
};

export function PlayerMannequin({ obj, court, pose, highlight, ball }: Props) {
  const { x, z } = courtToWorld(obj.x, obj.y, court);
  const jersey = shadeHex(obj.color, 0.08);
  const shorts = shadeHex(obj.color, -0.34);
  const glow = highlight ? 0.32 : 0;
  const angles = POSES[pose];
  const yaw = facingYaw(obj, ball, court);
  const label = obj.label.slice(0, 4);
  const texture = useMemo(() => makeLabelTexture(label, obj.color), [label, obj.color]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={[x, angles.lift, z]} rotation={[0, yaw, 0]}>
      <group position={[0, 0.78, 0]} rotation={xyz(angles.hip)}>
        <Box pos={[0, 0.05, 0]} size={[0.3, 0.22, 0.18]} color={shorts} glow={highlight === "lower" ? glow : 0} />
        <group position={[0, 0.18, 0]} rotation={xyz(angles.torso)}>
          <Box pos={[0, 0.22, 0]} size={[0.34, 0.44, 0.2]} color={jersey} glow={highlight === "upper" ? glow : 0} />
          <group position={[0, 0.48, 0]}>
            <Box pos={[0, 0.08, 0]} size={[0.1, 0.1, 0.1]} color={SKIN} />
            <mesh position={[0, 0.28, 0]} castShadow>
              <sphereGeometry args={[0.13, 10, 8]} />
              <meshStandardMaterial color={SKIN} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.38, 0.01]} castShadow>
              <sphereGeometry args={[0.132, 10, 8]} />
              <meshStandardMaterial color={HAIR} roughness={0.7} />
            </mesh>
          </group>
          <Arm side={-1} arm={angles.lArm} fore={angles.lFore} skin={SKIN} />
          <Arm side={1} arm={angles.rArm} fore={angles.rFore} skin={SKIN} />
        </group>
        <Leg side={-1} thigh={angles.lThigh} shin={angles.lShin} shorts={shorts} skin={SKIN} />
        <Leg side={1} thigh={angles.rThigh} shin={angles.rShin} shorts={shorts} skin={SKIN} />
      </group>
      <sprite position={[0, PLAYER_HEIGHT + 0.28 + (pose === "spike" ? 0.08 : 0), 0]} scale={[0.95, 0.38, 1]}>
        <spriteMaterial map={texture} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

function Arm({
  side,
  arm,
  fore,
  skin,
}: {
  side: -1 | 1;
  arm: Limb;
  fore: Limb;
  skin: string;
}) {
  return (
    <group position={[0.2 * side, 0.36, 0]} rotation={xyz(arm)}>
      <Box pos={[0, -0.14, 0]} size={[0.08, 0.28, 0.08]} color={skin} />
      <group position={[0, -0.28, 0]} rotation={xyz(fore)}>
        <Box pos={[0, -0.13, 0]} size={[0.07, 0.26, 0.07]} color={skin} />
        <Box pos={[0, -0.28, 0]} size={[0.08, 0.08, 0.06]} color={skin} />
      </group>
    </group>
  );
}

function Leg({
  side,
  thigh,
  shin,
  shorts,
  skin,
}: {
  side: -1 | 1;
  thigh: Limb;
  shin: Limb;
  shorts: string;
  skin: string;
}) {
  return (
    <group position={[0.09 * side, 0, 0]} rotation={xyz(thigh)}>
      <Box pos={[0, -0.18, 0]} size={[0.11, 0.36, 0.12]} color={shorts} />
      <group position={[0, -0.36, 0]} rotation={xyz(shin)}>
        <Box pos={[0, -0.18, 0]} size={[0.09, 0.36, 0.1]} color={skin} />
        <Box pos={[0, -0.38, 0.04]} size={[0.1, 0.07, 0.2]} color={SHOE} />
      </group>
    </group>
  );
}

function Box({
  pos,
  size,
  color,
  glow = 0,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  glow?: number;
}) {
  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.58}
        emissive={glow ? "#fff3c4" : "#000000"}
        emissiveIntensity={glow}
      />
    </mesh>
  );
}

function xyz(limb: Limb): [number, number, number] {
  return [limb.x ?? 0, limb.y ?? 0, limb.z ?? 0];
}

function facingYaw(obj: CourtObject, ball: BallPose | null, court: CourtType) {
  const p = courtToWorld(obj.x, obj.y, court);
  if (ball) {
    const b = courtToWorld(ball.x, ball.y, court);
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    if (Math.hypot(dx, dz) > 0.12) return Math.atan2(dx, dz);
  }
  return isOpponent(obj) ? 0 : Math.PI;
}

function makeLabelTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 96);
    const r = 18;
    ctx.fillStyle = "rgba(12,12,20,0.78)";
    ctx.beginPath();
    ctx.moveTo(r, 8);
    ctx.arcTo(248, 8, 248, 88, r);
    ctx.arcTo(248, 88, 8, 88, r);
    ctx.arcTo(8, 88, 8, 8, r);
    ctx.arcTo(8, 8, 248, 8, r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#f4f4f8";
    ctx.font = "700 42px Pretendard, Apple SD Gothic Neo, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text || "·", 128, 50);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
