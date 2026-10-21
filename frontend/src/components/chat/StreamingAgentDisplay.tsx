import React, { useEffect, useState, useRef } from 'react';
import { Brain, Cpu, Network, Search, Shield, Code, GitBranch, Sparkles, Zap, ChevronRight, Activity } from 'lucide-react';

const AGENTS = [
  { id: 'orchestrator', name: 'Orchestrator', icon: Network, color: 'sky' },
  { id: 'intent', name: 'Intent Detection', icon: Search, color: 'violet' },
  { id: 'requirements', name: 'Requirement Understanding', icon: Brain, color: 'indigo' },
  { id: 'guardrails', name: 'Guardrails Generator', icon: Shield, color: 'amber' },
  { id: 'cards', name: 'Agent Card Manager', icon: GitBranch, color: 'emerald' },
  { id: 'codegen', name: 'Code Generator', icon: Code, color: 'cyan' }
];

const THOUGHTS = [
  'Parsing user requirements...',
  'Identifying key capabilities...',
  'Analyzing tool dependencies...',
  'Designing agent architecture...',
  'Generating guardrail rules...',
  'Creating sub-agent hierarchy...',
  'Compiling agent cards...',
  'Writing Python ADK code...',
  'Optimizing tool definitions...',
  'Validating security constraints...'
];

interface Props { isActive: boolean; onPhaseChange?: (phase: string) => void; }

export const StreamingAgentDisplay: React.FC<Props> = ({ isActive, onPhaseChange }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [streamText, setStreamText] = useState('');
  const [typing, setTyping] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) { setActiveIdx(0); setThoughts([]); setStreamText(''); return; }
    const interval = setInterval(() => {
      setActiveIdx(i => { const next = Math.min(i + 1, AGENTS.length - 1); onPhaseChange?.(AGENTS[next].id); return next; });
    }, 3500);
    return () => clearInterval(interval);
  }, [isActive, onPhaseChange]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const thought = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
      setThoughts(p => [...p.slice(-8), `[${new Date().toLocaleTimeString()}] ${thought}`]);
    }, 1200);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => { logRef.current && (logRef.current.scrollTop = logRef.current.scrollHeight); }, [thoughts]);

  useEffect(() => {
    if (!isActive || activeIdx >= AGENTS.length) return;
    const agent = AGENTS[activeIdx];
    const text = `${agent.name}: Executing analysis pipeline...`;
    let i = 0; setStreamText(''); setTyping(true);
    const interval = setInterval(() => {
      if (i < text.length) { setStreamText(text.slice(0, i + 1)); i++; }
      else { setTyping(false); clearInterval(interval); }
    }, 40);
    return () => clearInterval(interval);
  }, [isActive, activeIdx]);

  if (!isActive) return null;

  return (
    <div className="space-y-3">
      {/* Agent Pipeline */}
      <div className="flex items-center gap-1 p-2 bg-slate-800/40 rounded-lg overflow-x-auto">
        {AGENTS.map((a, i) => {
          const Icon = a.icon;
          const status = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending';
          return (
            <React.Fragment key={a.id}>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${
                status === 'active' ? `bg-${a.color}-500/20 border border-${a.color}-500/50` :
                status === 'done' ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
                <Icon className={`w-3 h-3 ${status === 'active' ? `text-${a.color}-400 animate-pulse` : status === 'done' ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={`text-[9px] font-medium ${status === 'active' ? `text-${a.color}-300` : status === 'done' ? 'text-emerald-300' : 'text-slate-600'}`}>{a.name.split(' ')[0]}</span>
              </div>
              {i < AGENTS.length - 1 && <ChevronRight className={`w-3 h-3 flex-shrink-0 ${i < activeIdx ? 'text-emerald-500' : 'text-slate-700'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current Agent Status */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 rounded-lg border border-sky-500/20">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center animate-pulse">
          {React.createElement(AGENTS[activeIdx]?.icon || Brain, { className: 'w-5 h-5 text-white' })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-sky-300">{AGENTS[activeIdx]?.name || 'Processing'}</div>
          <div className="text-xs text-slate-400 font-mono truncate">{streamText}<span className={`${typing ? 'opacity-100' : 'opacity-0'} transition-opacity`}>▋</span></div>
        </div>
        <Activity className="w-5 h-5 text-sky-400 animate-pulse" />
      </div>

      {/* Thought Stream */}
      <div ref={logRef} className="h-24 p-2 bg-slate-900/50 rounded-lg border border-white/5 overflow-y-auto text-[10px] font-mono space-y-0.5 scrollbar-thin">
        {thoughts.map((t, i) => <div key={i} className={`text-slate-500 ${i === thoughts.length - 1 ? 'text-sky-400' : ''}`}>{t}</div>)}
        {thoughts.length === 0 && <div className="text-slate-600 animate-pulse">Initializing agent pipeline...</div>}
      </div>
    </div>
  );
};
