import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Terminal, 
  Code, 
  Settings, 
  ToggleLeft, 
  ToggleRight, 
  Activity, 
  CheckCircle2, 
  Sparkles,
  ChevronDown,
  X,
  Key,
  Plus,
  Layers,
  AlertCircle,
  Save,
  Check,
  Sun,
  Moon
} from 'lucide-react';
import { useAgentStudioStore } from './store/useAgentStudioStore';
import { ArchitectChat } from './components/chat/ArchitectChat';
import { AgentVisualizer3D } from './components/visualizer/AgentVisualizer3D';
import { LiveAgentRunner } from './components/sandbox/LiveAgentRunner';
import { CodeInspector } from './components/inspector/CodeInspector';
import { AgentActivitySidebar } from './components/AgentActivitySidebar';

export const App: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    mockMode, 
    setMockMode, 
    isAgentReady,
    checkEnvConfig,
    envConfig,
    showEnvModal,
    setShowEnvModal,
    saveEnvConfig,
    createdAgents,
    selectedAgent,
    setSelectedAgent,
    refreshCreatedAgents,
    startNewBuilderSession,
    startNewSandboxSession,
    isChatLoading
  } = useAgentStudioStore();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('gemini-3.6-flash');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [isSavingEnv, setIsSavingEnv] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage or default to dark
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  // Apply theme to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Initialize on mount
  useEffect(() => {
    checkEnvConfig();
    refreshCreatedAgents();
    startNewBuilderSession();
  }, []);

  // Sync modal inputs when envConfig is loaded
  useEffect(() => {
    if (envConfig) {
      setApiKeyInput(envConfig.apiKey || '');
      setModelInput(envConfig.model || 'gemini-3.6-flash');
    }
  }, [envConfig]);

  const handleSaveEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEnv(true);
    try {
      await saveEnvConfig(apiKeyInput, modelInput);
      setSaveSuccessMsg(true);
      setTimeout(() => {
        setSaveSuccessMsg(false);
        setShowEnvModal(false);
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Error saving .env: ' + err);
    } finally {
      setIsSavingEnv(false);
    }
  };

  const handleStartNewAgent = () => {
    startNewBuilderSession();
    setActiveTab('visualizer');
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors duration-300 ${isDarkMode ? 'bg-studio-bg text-slate-100' : 'bg-studio-bg text-slate-800'}`}>
      {/* Top Navbar */}
      <header className="h-12 border-b border-studio-border bg-studio-surface/80 backdrop-blur-xl px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Box className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider uppercase bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                ADK 3D Agent Studio
              </span>
              <span className="text-[10px] text-slate-400 font-mono ml-2 hidden sm:inline-block">
                v2.0 • Meta-Agent & Sandbox
              </span>
            </div>
          </div>

          {/* Create Another Agent Button */}
          <button
            onClick={handleStartNewAgent}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition-all shadow-sm"
            title="Start fresh session to create another agent"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Create Another Agent</span>
          </button>

          {/* Created Agents Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-mono transition-colors"
              title="Switch active agent in sandbox"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="max-w-[120px] truncate">
                {selectedAgent ? selectedAgent.name : 'Select Agent'}
              </span>
              <span className="text-[10px] px-1.5 rounded-full bg-indigo-500/20 text-indigo-300">
                {createdAgents.length}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {agentDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-60 rounded-xl bg-studio-card border border-white/10 shadow-2xl p-1.5 space-y-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-slate-400 border-b border-white/5 flex items-center justify-between">
                  <span>Created Agents</span>
                  <button
                    onClick={() => refreshCreatedAgents()}
                    className="text-[9px] text-sky-400 hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                {createdAgents.length === 0 ? (
                  <div className="p-2 text-xs text-slate-400">
                    No agents found in generated_agents/
                  </div>
                ) : (
                  createdAgents.map((ag) => (
                    <button
                      key={ag.name}
                      onClick={() => {
                        setSelectedAgent(ag);
                        setAgentDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${
                        selectedAgent?.name === ag.name
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <span className="font-semibold">{ag.name}</span>
                      <span className="text-[10px] text-slate-500">{ag.files.length} files</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center: Viewport Tabs */}
        <div className="flex items-center gap-1 bg-studio-card/80 border border-white/5 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'visualizer'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Visualizer</span>
          </button>

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'sandbox'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Live Sandbox</span>
            {isAgentReady && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'inspector'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>ADK Code</span>
          </button>
        </div>

        {/* Right: Agent Builder Status & Config */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Agent Builder: Active</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-lg border transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/5 hover:bg-white/10 text-amber-400 hover:text-amber-300 border-white/10' 
                : 'bg-amber-50 hover:bg-amber-100 text-amber-600 hover:text-amber-700 border-amber-200'
            }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => setShowEnvModal(true)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors"
            title="System & Google Gemini Environment Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Studio Workspace (Multi-Pane Layout) */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Pane: Smart Interactive Architect Chat */}
        <div className="w-[38%] min-w-[340px] max-w-[520px] h-full flex flex-col shrink-0">
          <ArchitectChat />
        </div>

        {/* Center Pane: Dual-Mode Viewport */}
        <div className="flex-1 h-full relative overflow-hidden bg-studio-bg">
          {activeTab === 'visualizer' && <AgentVisualizer3D />}
          {activeTab === 'sandbox' && <LiveAgentRunner />}
          {activeTab === 'inspector' && <CodeInspector />}
        </div>

        {/* Right Pane: Agent Activity Sidebar */}
        <AgentActivitySidebar isProcessing={isChatLoading} />
      </main>

      {/* Google Gemini API Key & Environment Config Modal (Zero LLM Interaction) */}
      {showEnvModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-studio-card border border-studio-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md">
                  <Key className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Google Gemini API Configuration
                  </h3>
                  <span className="text-[10px] text-sky-400 font-mono">
                    Zero LLM Interaction • Direct .env Write
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowEnvModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Agents are powered by Google Gemini (<code className="text-sky-300 font-mono">gemini-3.6-flash</code>). Enter your Google AI Studio API key below; it will be written directly to your local <code className="text-sky-300 font-mono">.env</code> file with pure file I/O.
            </p>

            <form onSubmit={handleSaveEnv} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
                  <span>GOOGLE_API_KEY</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {envConfig?.hasKey ? 'Configured in .env ✓' : 'Missing ⚠️'}
                  </span>
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your Google AI Studio API Key..."
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg bg-studio-surface border border-white/10 text-slate-200 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center justify-between">
                  <span>GEMINI_MODEL</span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {modelInput}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {[
                    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', tag: 'Fast' },
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Low Latency' },
                    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: 'Reasoning' },
                    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Efficient' }
                  ].map((m) => {
                    const isSelected = modelInput === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModelInput(m.id)}
                        className={`text-left p-2 rounded-lg border text-xs font-mono transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-studio-surface hover:bg-white/5 border-white/5 text-slate-300'
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className="text-[9px] uppercase px-1 rounded bg-white/10 text-slate-400 shrink-0">
                          {m.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  placeholder="gemini-3.6-flash"
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg bg-studio-surface border border-white/10 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] leading-relaxed">
                <strong>Configured Target:</strong> Writes directly to <code className="font-mono text-[10px] text-slate-200">project_root/.env</code>.
                No prompts or tokens are sent to any LLM for this operation.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEnvModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEnv}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
                    saveSuccessMsg
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/20'
                  }`}
                >
                  {saveSuccessMsg ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved to .env!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingEnv ? 'Saving...' : 'Save to .env'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
