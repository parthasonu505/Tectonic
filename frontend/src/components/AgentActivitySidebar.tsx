import React, { useEffect, useState } from 'react';
import { Brain, Shield, Code, Search, Network, GitBranch, CheckCircle2, Loader2, Activity, FileCode, Zap } from 'lucide-react';
import { useAgentStudioStore } from '../store/useAgentStudioStore';

interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'active' | 'complete';
  lastAction?: string;
}

const AGENTS_CONFIG = [
  { id: 'orchestrator', name: 'Orchestrator', icon: Network },
  { id: 'intent', name: 'Intent Detection', icon: Search },
  { id: 'requirements', name: 'Requirements', icon: Brain },
  { id: 'guardrails', name: 'Guardrails', icon: Shield },
  { id: 'cards', name: 'Agent Cards', icon: GitBranch },
  { id: 'codegen', name: 'Code Generator', icon: Code },
];

export const AgentActivitySidebar: React.FC<{ isProcessing: boolean }> = ({ isProcessing }) => {
  const { currentAgentPhase, pendingFiles, isGeneratingAgent } = useAgentStudioStore();
  const [agents, setAgents] = useState<AgentStatus[]>(
    AGENTS_CONFIG.map(a => ({ id: a.id, name: a.name, status: 'idle' }))
  );

  useEffect(() => {
    if (!isProcessing) {
      setAgents(AGENTS_CONFIG.map(a => ({ id: a.id, name: a.name, status: 'idle' })));
      return;
    }
    const phaseIdx = AGENTS_CONFIG.findIndex(a => a.id === currentAgentPhase);
    setAgents(AGENTS_CONFIG.map((a, i) => ({
      id: a.id,
      name: a.name,
      status: i < phaseIdx ? 'complete' : i === phaseIdx ? 'active' : 'idle',
      lastAction: i === phaseIdx ? 'Processing...' : i < phaseIdx ? 'Done' : undefined
    })));
  }, [isProcessing, currentAgentPhase]);

  return (
    <div className="w-52 shrink-0 border-l border-studio-border bg-studio-surface/30 p-3 hidden xl:block">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
        <Activity className="w-4 h-4 text-sky-400" />
        <span className="text-xs font-semibold text-slate-300">Agent Pipeline</span>
        {isProcessing && <Zap className="w-3 h-3 text-amber-400 animate-pulse ml-auto" />}
      </div>
      
      <div className="space-y-1.5">
        {agents.map((agent, idx) => {
          const config = AGENTS_CONFIG[idx];
          const Icon = config.icon;
          return (
            <div key={agent.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all duration-300 ${
              agent.status === 'active' ? 'bg-sky-500/15 border-sky-500/40 shadow-lg shadow-sky-500/10' :
              agent.status === 'complete' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5'
            }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                agent.status === 'active' ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md' :
                agent.status === 'complete' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-slate-500'
              }`}>
                {agent.status === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                 agent.status === 'complete' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[10px] font-semibold truncate ${
                  agent.status === 'active' ? 'text-sky-300' : agent.status === 'complete' ? 'text-emerald-300' : 'text-slate-500'
                }`}>{agent.name}</div>
                {agent.status === 'active' && (
                  <div className="h-1 mt-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 animate-pulse" style={{width: '60%'}} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* File Generation Progress */}
      {isGeneratingAgent && pendingFiles.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-300">Generating Files</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
            {pendingFiles.map((f, i) => (
              <div key={f.path} className="text-[9px] font-mono text-slate-500 truncate flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                {f.path.split('/').pop()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
