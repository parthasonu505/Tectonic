import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Float, Line } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Wrench, 
  Database, 
  ShieldCheck, 
  Cpu, 
  X, 
  ExternalLink,
  Layers,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { useAgentStudioStore } from '../../store/useAgentStudioStore';
import type { AgentTool } from '../../types/agent';

// Central Coordinator Core Node
const CoordinatorNode = ({ isMultiAgent }: { isMultiAgent: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4;
      meshRef.current.rotation.x += delta * 0.2;
    }
    if (glowRef.current) {
      glowRef.current.rotation.y -= delta * 0.3;
      const scale = 1.05 + Math.sin(state.clock.elapsedTime * 2.5) * 0.05;
      glowRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Outer Glow shell */}
      <mesh ref={glowRef}>
        <icosahedronGeometry args={[1.25, 2]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Main Core Solid */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.0, 1]} />
        <meshStandardMaterial
          color="#0284c7"
          emissive="#0369a1"
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Floating HTML Label */}
      <Html distanceFactor={12} position={[0, 1.6, 0]} center>
        <div className="flex flex-col items-center pointer-events-none select-none">
          <div className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-sky-400/50 backdrop-blur-md shadow-lg shadow-sky-500/20 flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span className="text-[11px] font-mono font-bold text-sky-200">
              {isMultiAgent ? 'CoordinatorAgent' : 'FlightCoordinatorAgent'}
            </span>
          </div>
          <span className="text-[9px] font-mono text-sky-400/80 mt-0.5">Core Kernel (ADK)</span>
        </div>
      </Html>
    </group>
  );
};

// Translucent Guardrail Shield
const GuardrailShield = ({ active, count }: { active: boolean; count: number }) => {
  const shieldRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (shieldRef.current) {
      shieldRef.current.rotation.y += delta * 0.15;
      shieldRef.current.rotation.z += delta * 0.08;
      if (active) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.03;
        shieldRef.current.scale.set(pulse, pulse, pulse);
      }
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={shieldRef}>
        <sphereGeometry args={[2.0, 24, 24]} />
        <meshStandardMaterial
          color={active ? '#10b981' : '#64748b'}
          emissive={active ? '#10b981' : '#334155'}
          emissiveIntensity={active ? 0.4 : 0.1}
          wireframe
          transparent
          opacity={active ? 0.22 : 0.08}
        />
      </mesh>

      <Html distanceFactor={14} position={[0, -2.1, 0]} center>
        <div className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[10px] text-emerald-300 font-mono flex items-center gap-1 select-none pointer-events-none whitespace-nowrap">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Active Guardrails ({count})</span>
        </div>
      </Html>
    </group>
  );
};

// Orbiting Tool Node Satellite
interface OrbitingToolProps {
  tool: AgentTool;
  index: number;
  total: number;
  onSelect: (tool: AgentTool) => void;
  isActiveTrace?: boolean;
}

const OrbitingToolNode = ({ tool, index, total, onSelect, isActiveTrace }: OrbitingToolProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const angleRef = useRef<number>((index / total) * Math.PI * 2);
  const radius = 3.6;
  const speed = 0.35 + (index % 3) * 0.05;

  useFrame((_, delta) => {
    angleRef.current += delta * speed * 0.5;
    const x = Math.cos(angleRef.current) * radius;
    const z = Math.sin(angleRef.current) * radius;
    const y = Math.sin(angleRef.current * 2 + index) * 0.6;

    if (meshRef.current) {
      meshRef.current.position.set(x, y, z);
      meshRef.current.rotation.x += delta * 1.5;
      meshRef.current.rotation.y += delta * 1.5;
    }
  });

  const toolColor = isActiveTrace ? '#f43f5e' : (tool.color || '#38bdf8');

  return (
    <group>
      {/* Orbit visual track */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.015, radius + 0.015, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>

      {/* Orbiting Satellite Node */}
      <mesh 
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(tool);
        }}
        className="cursor-pointer"
      >
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial
          color={toolColor}
          emissive={toolColor}
          emissiveIntensity={isActiveTrace ? 0.9 : 0.5}
          roughness={0.3}
          metalness={0.7}
        />

        {/* Floating Tool Name Label */}
        <Html distanceFactor={10} position={[0, 0.6, 0]} center>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onSelect(tool);
            }}
            className={`px-2 py-0.5 rounded-md border text-[10px] font-mono cursor-pointer transition-all whitespace-nowrap shadow-md ${
              isActiveTrace
                ? 'bg-rose-500/90 text-white border-rose-300 animate-bounce'
                : 'bg-slate-900/85 hover:bg-slate-800 text-sky-200 hover:text-white border-sky-400/40 hover:border-sky-300'
            }`}
          >
            {tool.name}
          </div>
        </Html>
      </mesh>
    </group>
  );
};

// Sub-Agent Node & Connecting Beam
interface SubAgentProps {
  id: string;
  name: string;
  color: string;
  index: number;
  total: number;
  tools: string[];
}

const SubAgentNodeItem = ({ name, color, index, total }: SubAgentProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const angle = (index / total) * Math.PI * 2 + Math.PI / 4;
  const dist = 5.2;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;
  const y = 0.5;

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.8;
      meshRef.current.position.y = y + Math.sin(state.clock.elapsedTime * 2 + index) * 0.2;
    }
  });

  return (
    <group position={[x, y, z]}>
      {/* Connecting Beam to Coordinator Core */}
      <Line
        points={[[0, 0, 0], [-x, -y, -z]]}
        color={color}
        lineWidth={1.5}
        transparent
        opacity={0.35}
        dashed
        dashScale={2}
      />

      <mesh ref={meshRef}>
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.8}
        />

        <Html distanceFactor={11} position={[0, 0.8, 0]} center>
          <div className="px-2 py-0.5 rounded-lg bg-slate-950/90 border border-purple-500/40 text-[10px] font-mono text-purple-200 select-none whitespace-nowrap shadow-lg">
            ⚡ {name}
          </div>
        </Html>
      </mesh>
    </group>
  );
};

// Storage 3D Cylinder / Block Node at Base
const StorageNode = ({ storageType }: { storageType: string }) => {
  const isSqlite = storageType.toLowerCase().includes('sqlite');
  const cylinderRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (cylinderRef.current) {
      cylinderRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group position={[0, -3.2, 0]}>
      {/* Cylinder Database / Storage Pod */}
      <mesh ref={cylinderRef}>
        <cylinderGeometry args={[1.1, 1.1, 0.8, 24]} />
        <meshStandardMaterial
          color={isSqlite ? '#0284c7' : '#f59e0b'}
          emissive={isSqlite ? '#0284c7' : '#f59e0b'}
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Ring indicator around base */}
      <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.35, 32]} />
        <meshBasicMaterial 
          color={isSqlite ? '#38bdf8' : '#f59e0b'} 
          transparent 
          opacity={0.4} 
          side={THREE.DoubleSide} 
        />
      </mesh>

      <Html distanceFactor={11} position={[0, -0.7, 0]} center>
        <div className="px-2.5 py-1 rounded-md bg-slate-950/90 border border-white/10 text-[10px] font-mono text-slate-300 flex items-center gap-1.5 select-none whitespace-nowrap shadow-lg">
          <Database className="w-3.5 h-3.5 text-sky-400" />
          <span>{isSqlite ? 'Storage: SQLite DB' : 'Storage: JSON Files'}</span>
        </div>
      </Html>
    </group>
  );
};

// Particles Background Field
const Starfield = () => {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 400; i++) {
      const x = (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      pts.push(x, y, z);
    }
    return new Float32Array(pts);
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length / 3}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#38bdf8" transparent opacity={0.3} />
    </points>
  );
};

export const AgentVisualizer3D: React.FC = () => {
  const { 
    spec, 
    selectedToolNode, 
    setSelectedToolNode,
    activeToolTrace 
  } = useAgentStudioStore();

  const isMultiAgent = spec.architecture === 'sub_agents';

  return (
    <div className="relative w-full h-full bg-studio-bg overflow-hidden select-none">
      {/* 3D R3F Canvas */}
      <Canvas
        camera={{ position: [0, 2.5, 9], fov: 50 }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#38bdf8" />
        <pointLight position={[-10, -10, -10]} intensity={1.0} color="#a855f7" />
        <directionalLight position={[0, 8, 4]} intensity={0.8} />

        <Starfield />

        {/* Central Coordinator Agent Core */}
        <CoordinatorNode isMultiAgent={isMultiAgent} />

        {/* Wireframe Guardrail Shield */}
        <GuardrailShield active={spec.guardrails.length > 0} count={spec.guardrails.length} />

        {/* Orbiting Satellite Tool Nodes */}
        {spec.tools.map((tool, idx) => (
          <OrbitingToolNode
            key={tool.name}
            tool={tool}
            index={idx}
            total={spec.tools.length}
            onSelect={(t) => setSelectedToolNode(t)}
            isActiveTrace={activeToolTrace === tool.name}
          />
        ))}

        {/* Dynamic Sub-Agents (Shown if multi-agent selected) */}
        {isMultiAgent && (
          <group>
            {spec.subAgents.map((sub, idx) => (
              <SubAgentNodeItem
                key={sub.id}
                id={sub.id}
                name={sub.name}
                color={sub.color}
                index={idx}
                total={spec.subAgents.length}
                tools={sub.tools}
              />
            ))}
          </group>
        )}

        {/* Persistent Storage Node */}
        <StorageNode storageType={spec.storage} />

        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          minDistance={4}
          maxDistance={18}
          maxPolarAngle={Math.PI / 1.7}
        />
      </Canvas>

      {/* Floating Canvas Top Overlay Controls / Status */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-lg bg-studio-surface/80 border border-white/10 backdrop-blur-md flex items-center gap-2 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-slate-300 font-semibold">
            Mode: {isMultiAgent ? 'Multi-Agent Hierarchy' : 'Single Coordinator'}
          </span>
          <span className="text-[10px] text-slate-500">|</span>
          <span className="text-xs font-mono text-sky-400">
            {spec.tools.length} Orbiting Tools
          </span>
        </div>
      </div>

      <div className="absolute top-3 right-3 z-10 text-[11px] text-slate-400 px-2.5 py-1 rounded bg-studio-surface/60 border border-white/5 backdrop-blur-md">
        Drag to Orbit • Scroll to Zoom
      </div>

      {/* Tool Schema & Details Floating HUD Drawer */}
      {selectedToolNode && (
        <div className="absolute bottom-4 right-4 z-20 w-80 rounded-xl bg-studio-card/95 border border-sky-500/40 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between border-b border-white/10 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-mono font-bold text-sky-300">
                  {selectedToolNode.name}
                </h4>
                <span className="text-[10px] text-slate-400">ADK Tool Node</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedToolNode(null)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-300 mb-3 leading-relaxed">
            {selectedToolNode.description}
          </p>

          <div className="space-y-2 mb-3">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
              Parameters Schema:
            </span>
            <div className="bg-slate-950/80 rounded-lg p-2.5 border border-white/5 text-[11px] font-mono text-slate-200 space-y-1">
              {Object.entries(selectedToolNode.parameters).map(([param, type]) => (
                <div key={param} className="flex justify-between">
                  <span className="text-sky-400">{param}:</span>
                  <span className="text-slate-400">{type}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
              Return Value:
            </span>
            <div className="bg-slate-950/80 rounded-lg p-2 border border-white/5 text-[11px] font-mono text-emerald-400">
              {selectedToolNode.returns}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
