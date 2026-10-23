import React, { useEffect, useRef, useState } from 'react';
import { Brain, Network, Search, Shield, Code, GitBranch, ChevronRight, Activity } from 'lucide-react';
import { useTelemetryStore } from '../../store/useTelemetryStore';

// Builder pipeline stages, keyed by the real ADK agent (or tool) names reported over /ws/telemetry.
const STAGES = [
  { id: 'agent_builder', name: 'Orchestrator', icon: Network },
  { id: 'intent_detection', name: 'Intent', icon: Search },
  { id: 'requirement_understanding', name: 'Requirements', icon: Brain },
  { id: 'guardrails', name: 'Guardrails', icon: Shield, tool: true },
  { id: 'agent_card_manager', name: 'Agent Card', icon: GitBranch },
  { id: 'code_generator', name: 'Code Generator', icon: Code },
] as const;

type StageStatus = 'pending' | 'active' | 'done';

interface Props { isActive: boolean; onPhaseChange?: (phase: string) => void; }

export const StreamingAgentDisplay: React.FC<Props> = ({ isActive, onPhaseChange }) => {
  const [since, setSince] = useState(0);
  const agents = useTelemetryStore((s) => s.agents);
  const toolCalls = useTelemetryStore((s) => s.toolCalls);
  const traces = useTelemetryStore((s) => s.traces);
  const logs = useTelemetryStore((s) => s.logs);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) setSince(Date.now() / 1000 - 1);
  }, [isActive]);

  const root = agents.agent_builder;
  const statusOf = (stage: (typeof STAGES)[number]): StageStatus => {
    if ('tool' in stage) {
      const calls = (toolCalls.agent_builder ?? []).filter((c) => c.toolName === stage.id && c.startedAt >= since);
      if (calls.some((c) => c.status === 'running')) return 'active';
      return calls.length > 0 ? 'done' : 'pending';
    }
    const agent = agents[stage.id];
    if (!agent || agent.lastActiveAt < since) return 'pending';
    return agent.state === 'idle' ? 'done' : 'active';
  };
  const statuses = STAGES.map(statusOf);

  // The deepest busy stage is the one doing the work (the orchestrator waits on its sub-agents).
  let currentIdx = -1;
  statuses.forEach((s, i) => { if (s === 'active') currentIdx = i; });
  const current = currentIdx >= 0 ? STAGES[currentIdx] : STAGES[0];

  useEffect(() => {
    if (isActive && currentIdx >= 0) onPhaseChange?.(STAGES[currentIdx].id);
  }, [isActive, currentIdx, onPhaseChange]);

  const recent = logs.filter((l) => l.timestamp >= since).slice(-8);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [recent.length]);

  if (!isActive) return null;

  let statusLine = 'Waiting for the orchestrator…';
  if ('tool' in current && current.tool) {
    statusLine = 'Running deterministic guardrail checks';
  } else {
    const agent = agents[current.id];
    const lastText = traces[current.id]?.at(-1)?.text.trim().split('\n').at(-1) ?? '';
    if (agent?.state === 'tool_execution' && agent.stateDetail) statusLine = `Calling ${agent.stateDetail}`;
    else if (lastText) statusLine = lastText;
    else if (root) statusLine = 'Thinking…';
  }

  return (
    <div className="space-y-3">
      {/* Agent Pipeline */}
      <div className="flex items-center gap-1 p-2 bg-slate-800/40 rounded-lg overflow-x-auto">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const status = statuses[i];
          return (
            <React.Fragment key={stage.id}>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${
                status === 'active' ? 'bg-sky-500/20 border border-sky-500/50' :
                status === 'done' ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
                <Icon className={`w-3 h-3 ${status === 'active' ? 'text-sky-400 animate-pulse' : status === 'done' ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={`text-[9px] font-medium whitespace-nowrap ${status === 'active' ? 'text-sky-300' : status === 'done' ? 'text-emerald-300' : 'text-slate-600'}`}>{stage.name}</span>
              </div>
              {i < STAGES.length - 1 && <ChevronRight className={`w-3 h-3 flex-shrink-0 ${status === 'done' ? 'text-emerald-500' : 'text-slate-700'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current Agent Status */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 rounded-lg border border-sky-500/20">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center animate-pulse">
          {React.createElement(current.icon, { className: 'w-5 h-5 text-white' })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-sky-300">{current.name}</div>
          <div className="text-xs text-slate-400 font-mono truncate">{statusLine}<span className="animate-pulse">▋</span></div>
        </div>
        <Activity className="w-5 h-5 text-sky-400 animate-pulse" />
      </div>

      {/* Live event stream (same feed as the Command Center ticker) */}
      <div ref={logRef} className="h-24 p-2 bg-slate-900/50 rounded-lg border border-white/5 overflow-y-auto text-[10px] font-mono space-y-0.5 scrollbar-thin">
        {recent.map((l, i) => (
          <div key={l.seq} className={`truncate ${i === recent.length - 1 ? 'text-sky-400' : 'text-slate-500'}`}>
            [{new Date(l.timestamp * 1000).toLocaleTimeString()}] {l.text}
          </div>
        ))}
        {recent.length === 0 && <div className="text-slate-600 animate-pulse">Waiting for agent telemetry…</div>}
      </div>
    </div>
  );
};
