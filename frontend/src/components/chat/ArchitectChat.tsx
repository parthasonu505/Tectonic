import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  User, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  Wrench, 
  ShieldCheck, 
  Target, 
  RefreshCw, 
  Plus,
  Sparkles,
  Key
} from 'lucide-react';
import { useAgentStudioStore } from '../../store/useAgentStudioStore';
import { DecisionCardGroup } from './DecisionCardGroup';
import { MarkdownContent } from './MarkdownContent';

export const ArchitectChat: React.FC = () => {
  const { 
    chatMessages, 
    sendArchitectMessage, 
    isChatLoading, 
    spec,
    hudCollapsed,
    setHudCollapsed,
    startNewBuilderSession,
    builderSessionId,
    envConfig,
    setShowEnvModal
  } = useAgentStudioStore();

  const [inputVal, setInputVal] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isChatLoading) return;
    const msg = inputVal;
    setInputVal('');
    sendArchitectMessage(msg);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendArchitectMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-studio-surface/50 border-r border-studio-border backdrop-blur-xl relative">
      {/* Pinned Collapsible HUD Requirement Card */}
      <div className="p-3.5 border-b border-studio-border bg-studio-card/75 backdrop-blur-md z-10 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-sky-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              Agent Architect HUD
            </span>
            {builderSessionId && (
              <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                sid:{builderSessionId.slice(0, 6)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Create Another Agent Button */}
            <button
              onClick={() => startNewBuilderSession()}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 flex items-center gap-1 transition-all shadow-sm font-semibold"
              title="Start a new session to create another agent"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Another Agent</span>
            </button>

            <button
              onClick={() => startNewBuilderSession()}
              className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              title="Reset builder session"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setHudCollapsed(!hudCollapsed)}
              className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              {hudCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* HUD Content */}
        {!hudCollapsed && (
          <div className="mt-3 space-y-2.5 text-xs animate-in fade-in duration-200">
            {/* Goal */}
            <div className="bg-white/[0.02] border border-white/5 p-2 rounded-lg">
              <span className="text-slate-400 font-medium text-[11px] block mb-0.5">Identified Goal</span>
              <p className="text-slate-200 text-xs leading-relaxed line-clamp-2">
                {spec.goal}
              </p>
            </div>

            {/* Configured Tools & Capabilities */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                  <Wrench className="w-3 h-3 text-sky-400" />
                  Configured Tools ({spec.tools.length})
                </span>
                <span className="text-[10px] text-sky-400 font-mono">Real-time sync</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {spec.tools.map((t) => (
                  <span
                    key={t.name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20 shadow-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    {t.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Safety Guardrails */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Safety Guardrails ({spec.guardrails.length})
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Zero-LLM Input/Output Filter</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {spec.guardrails.map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Messages Stream */}
      <div 
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {chatMessages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-300">
                    {isUser ? 'You (Architect)' : 'Meta-Agent Builder'}
                  </span>
                  <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                </div>

                {/* Message Body */}
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isUser
                      ? 'bg-sky-600 text-white rounded-tr-none shadow-md shadow-sky-600/20'
                      : 'bg-studio-card/90 border border-white/5 text-slate-200 rounded-tl-none shadow-sm'
                  }`}
                >
                  <MarkdownContent content={msg.content} isUser={isUser} />

                  {/* If this message contains interactive decisions, render the form */}
                  {msg.decisionGroup && (
                    <DecisionCardGroup decisionGroup={msg.decisionGroup} />
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          );
        })}

        {isChatLoading && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0 animate-pulse">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="p-3 rounded-2xl bg-studio-card/90 border border-white/5 text-xs text-slate-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]" />
              <span>Analyzing requirements & building agent with Google Gemini (gemini-3.6-flash)...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Suggestion Chips */}
      <div className="px-4 py-2 border-t border-white/5 bg-studio-surface/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] uppercase font-mono text-slate-500 shrink-0">Suggestions:</span>
        <button
          onClick={() => handleQuickPrompt('Create an attendance manager agent that logs employee check-in and generates reports')}
          className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 whitespace-nowrap transition-colors"
        >
          Attendance Manager
        </button>
        <button
          onClick={() => handleQuickPrompt('Create a local meeting scheduler agent with SQLite storage and iCal integration')}
          className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 whitespace-nowrap transition-colors"
        >
          Meeting Scheduler
        </button>
        <button
          onClick={() => handleQuickPrompt('Build a personal finance expense tracker that enforces PII sanitization and daily spend limits')}
          className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 whitespace-nowrap transition-colors"
        >
          Expense Tracker
        </button>
      </div>

      {/* Input Chat Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-studio-border bg-studio-card/80">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isChatLoading}
            placeholder="Describe what agent you want to create (e.g. attendance tracker, meeting scheduler)..."
            className="w-full text-xs bg-studio-surface/90 border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isChatLoading}
            className="absolute right-2 p-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-30 disabled:hover:bg-sky-500 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
