import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group, type SpriteMaterial } from 'three';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import type { Packet } from '../../types/telemetry';
import { Halo } from './glow';
import type { OfficeLayout, Vec3 } from './officeLayout';

const TRAVEL_MS = 1150;
const DESK_ANCHOR_Y = 1.45;
const STATION_ANCHOR_Y = 1.6;
const TRAIL = 4;

/** Resolve a graph edge id to world endpoints. Mirrors the edge ids the Command Center uses. */
function endpoints(edgeId: string, layout: OfficeLayout): { from: Vec3; to: Vec3; module: boolean } | null {
  const lift = (p: Vec3 | undefined, y: number): Vec3 | null => (p ? [p[0], y, p[2]] : null);
  let a: Vec3 | null = null;
  let b: Vec3 | null = null;
  let module = false;
  if (edgeId.startsWith('h:')) {
    const [parent, child] = edgeId.slice(2).split('->');
    a = lift(layout.desks[parent], DESK_ANCHOR_Y);
    b = lift(layout.desks[child], DESK_ANCHOR_Y);
  } else if (edgeId.startsWith('m:')) {
    const [agent, mod] = edgeId.slice(2).split('->');
    a = lift(layout.desks[agent], DESK_ANCHOR_Y);
    b = lift(layout.stations[mod], STATION_ANCHOR_Y);
    module = true;
  } else if (edgeId.startsWith('x:')) {
    const [x, y] = edgeId.slice(2).split('<->');
    a = lift(layout.desks[x], DESK_ANCHOR_Y);
    b = lift(layout.desks[y], DESK_ANCHOR_Y);
  }
  return a && b ? { from: a, to: b, module } : null;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function Beam({ packet, layout }: { packet: Packet; layout: OfficeLayout }) {
  const heads = useRef<(Group | null)[]>([]);
  const ends = endpoints(packet.edgeId, layout);
  const vectors = useRef<{ a: Vector3; b: Vector3; c: Vector3 } | null>(null);
  if (ends && !vectors.current) {
    const [from, to] = packet.reverse ? [ends.to, ends.from] : [ends.from, ends.to];
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const c = a.clone().lerp(b, 0.5);
    c.y += 1.2 + a.distanceTo(b) * 0.12; // arc over the desks
    vectors.current = { a, b, c };
  }

  useFrame(() => {
    const v = vectors.current;
    if (!v) return;
    const raw = (Date.now() - packet.bornAt) / TRAVEL_MS;
    heads.current.forEach((g, i) => {
      if (!g) return;
      const t = raw - i * 0.045;
      const visible = t >= 0 && t <= 1;
      g.visible = visible;
      if (!visible) return;
      const e = ease(t);
      const u = 1 - e;
      g.position.set(
        u * u * v.a.x + 2 * u * e * v.c.x + e * e * v.b.x,
        u * u * v.a.y + 2 * u * e * v.c.y + e * e * v.b.y,
        u * u * v.a.z + 2 * u * e * v.c.z + e * e * v.b.z,
      );
      const fade = t > 0.85 ? (1 - t) / 0.15 : 1;
      g.children.forEach((child) => {
        const mat = (child as unknown as { material?: SpriteMaterial }).material;
        if (mat) mat.opacity = (i === 0 ? 0.95 : 0.5 / (i + 1)) * fade;
      });
    });
  });

  if (!ends) return null;
  const color = ends.module ? '#A78BFA' : '#2DD4FF';
  return (
    <>
      {Array.from({ length: TRAIL }, (_, i) => (
        <group key={i} ref={(g) => { heads.current[i] = g; }} visible={false}>
          <Halo color={color} size={i === 0 ? 0.9 : 0.55 - i * 0.08} opacity={0.9} />
          {i === 0 && (
            <mesh>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshBasicMaterial color="#F5F3FF" toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function PacketsImpl({ layout }: { layout: OfficeLayout }) {
  const packets = useTelemetryStore((s) => s.packets);
  return (
    <>
      {packets.map((p) => (
        <Beam key={p.key} packet={p} layout={layout} />
      ))}
    </>
  );
}

export const Packets = memo(PacketsImpl);
