import { create } from 'zustand';
import type { 
  AgentTool, 
  ExtractedAgentSpec, 
  DecisionGroup,
  BuilderJourney,
  ChatMessage,
  SandboxChatMessage,
  CreatedAgent,
  EnvConfig,
  AgentEnvConfig,
  FileWriteEvent,
  AgentEvent
} from '../types/agent';
import { api, DEFAULT_MOCK_SPEC } from '../services/api';

export type StudioTab = 'command' | 'visualizer' | 'sandbox' | 'inspector';

interface AgentStudioState {
  // Navigation & UI
  activeTab: StudioTab;
  /** Bumped on every tab request so the workspace reveals the window even if the tab is unchanged. */
  tabNonce: number;
  setActiveTab: (tab: StudioTab) => void;
  mockMode: boolean;
  setMockMode: (val: boolean) => void;
  hudCollapsed: boolean;
  setHudCollapsed: (val: boolean) => void;

  // Google Gemini Global Environment & API Key (Zero LLM)
  envConfig: EnvConfig | null;
  isCheckingEnv: boolean;
  showEnvModal: boolean;
  setShowEnvModal: (val: boolean) => void;
  checkEnvConfig: () => Promise<void>;
  saveEnvConfig: (apiKey: string, model?: string) => Promise<{ success: boolean; message: string }>;

  // Specific Agent .env in Sandbox
  selectedAgentEnv: AgentEnvConfig | null;
  showAgentEnvModal: boolean;
  setShowAgentEnvModal: (val: boolean) => void;
  checkSelectedAgentEnv: (agentName?: string) => Promise<AgentEnvConfig | null>;
  saveSelectedAgentEnv: (agentName: string, apiKey: string, model?: string) => Promise<{ success: boolean; message: string }>;

  // Created Agents List
  createdAgents: CreatedAgent[];
  selectedAgent: CreatedAgent | null;
  setSelectedAgent: (agent: CreatedAgent | null) => void;
  /** Re-reads generated_agents/. Returns agents that appeared since the last refresh and selects the newest of them. */
  refreshCreatedAgents: () => Promise<CreatedAgent[]>;
  agentsLoaded: boolean;

  // Sessions
  builderSessionId: string | null;
  sandboxSessionId: string | null;
  startNewBuilderSession: () => Promise<void>;
  startNewSandboxSession: (agentAppName?: string) => Promise<void>;

  // Selected 3D Node Drawer
  selectedToolNode: AgentTool | null;
  setSelectedToolNode: (tool: AgentTool | null) => void;

  // Architect Chat State (No Dummy replies)
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  /** `display` is what the chat shows (e.g. human-readable choices without the DECISIONS_JSON payload). */
  sendArchitectMessage: (content: string, display?: string) => Promise<void>;

  // Extracted Spec & Live Architecture Preview
  spec: ExtractedAgentSpec;
  updateSpec: (partial: Partial<ExtractedAgentSpec>) => void;

  // Interactive Decisions Group
  currentDecisionGroup: DecisionGroup | null;
  /** Guided interview / build progress from the Builder's `build_phase` state. */
  builderJourney: BuilderJourney | null;
  updateDecisionOption: (questionId: string, optionId: string) => void;
  toggleCustomDecision: (questionId: string, isCustom: boolean) => void;
  setCustomDecisionValue: (questionId: string, val: string) => void;
  setExtraNotes: (notes: string) => void;
  applyRecommendedDefaults: () => void;
  submitDecisions: () => Promise<void>;

  // Generation & ADK Project Status
  isGeneratingAgent: boolean;
  isAgentReady: boolean;
  generatedFiles: Record<string, string>;

  // Inspector & Updating Files
  currentAgentFiles: Record<string, string>;
  selectedFilePath: string;
  setSelectedFilePath: (p: string) => void;
  loadAgentFiles: (agentName: string) => Promise<void>;
  saveAgentFile: (filePath: string, content: string) => Promise<{ success: boolean; message: string }>;

  // Live Agent Sandbox State
  sandboxMessages: SandboxChatMessage[];
  isSandboxLoading: boolean;
  activeToolTrace: string | null;
  activeGuardrailTrace: string | null;
  sendSandboxMessage: (content: string) => Promise<void>;
  resetSandbox: () => void;
  resetDemoToInitial: () => void;

  // Streaming & File Writing State
  isStreaming: boolean;
  streamingText: string;
  currentAgentPhase: string;
  fileWriteEvents: FileWriteEvent[];
  agentEvents: AgentEvent[];
  pendingFiles: { path: string; content: string }[];
  setStreamingState: (isStreaming: boolean, text?: string) => void;
  setCurrentAgentPhase: (phase: string) => void;
  addFileWriteEvent: (event: FileWriteEvent) => void;
  addAgentEvent: (event: AgentEvent) => void;
  setPendingFiles: (files: { path: string; content: string }[]) => void;
  clearStreamingState: () => void;
}

export const useAgentStudioStore = create<AgentStudioState>((set, get) => ({
  activeTab: 'command',
  tabNonce: 0,
  setActiveTab: (tab) => set({ activeTab: tab, tabNonce: Date.now() }),
  mockMode: false,
  setMockMode: (val) => {
    api.setMockMode(val);
    set({ mockMode: val });
  },
  hudCollapsed: false,
  setHudCollapsed: (val) => set({ hudCollapsed: val }),

  // Global Google Gemini Environment State
  envConfig: null,
  isCheckingEnv: false,
  showEnvModal: false,
  setShowEnvModal: (val) => set({ showEnvModal: val }),

  checkEnvConfig: async () => {
    set({ isCheckingEnv: true });
    try {
      const cfg = await api.getEnvConfig();
      set({ envConfig: cfg, isCheckingEnv: false });
    } catch {
      set({ isCheckingEnv: false });
    }
  },

  saveEnvConfig: async (apiKey: string, model: string = 'gemini-3.6-flash') => {
    const res = await api.saveEnvConfig(apiKey, model);
    const updated = await api.getEnvConfig();
    set({ envConfig: updated, showEnvModal: false });
    return res;
  },

  // Agent Specific Environment in Sandbox
  selectedAgentEnv: null,
  showAgentEnvModal: false,
  setShowAgentEnvModal: (val) => set({ showAgentEnvModal: val }),

  checkSelectedAgentEnv: async (agentName?: string) => {
    const target = agentName || get().selectedAgent?.name;
    if (!target) return null;
    try {
      const cfg = await api.getAgentEnv(target);
      set({ selectedAgentEnv: cfg });
      return cfg;
    } catch (err) {
      console.warn('Failed to get agent env:', err);
      return null;
    }
  },

  saveSelectedAgentEnv: async (agentName: string, apiKey: string, model: string = 'gemini-3.6-flash') => {
    const res = await api.saveAgentEnv(agentName, apiKey, model);
    const updated = await api.getAgentEnv(agentName);
    set({ selectedAgentEnv: updated, showAgentEnvModal: false });
    return res;
  },

  // Created Agents State
  createdAgents: [],
  selectedAgent: null,
  setSelectedAgent: (agent) => {
    set({ selectedAgent: agent });
    if (agent) {
      get().startNewSandboxSession(agent.appName);
      get().loadAgentFiles(agent.name);
      get().checkSelectedAgentEnv(agent.name);
    }
  },

  agentsLoaded: false,

  refreshCreatedAgents: async () => {
    const { createdAgents: previous, agentsLoaded } = get();
    const agents = await api.fetchCreatedAgents(); // newest first
    const known = new Set(previous.map((a) => a.name));
    const added = agentsLoaded ? agents.filter((a) => !known.has(a.name)) : [];
    set({ createdAgents: agents, agentsLoaded: true });
    if (added.length > 0) {
      // A project was just generated: point the sandbox, inspector and env checks at it.
      get().setSelectedAgent(added[0]);
    } else if (!get().selectedAgent && agents.length > 0) {
      get().setSelectedAgent(agents[0]);
    }
    return added;
  },

  // Sessions
  builderSessionId: null,
  sandboxSessionId: null,

  startNewBuilderSession: async () => {
    set({ isChatLoading: true });
    try {
      const newSid = await api.createSession('agent_builder');
      set({
        builderSessionId: newSid,
        chatMessages: [
          {
            id: `msg-welcome-${Date.now()}`,
            sender: 'assistant',
            content: `👋 **Agent Architect Session Initialized!**\n\nI am the Meta-Agent Builder. I use sub-agents (**guardrails**, **intent detection**, **requirement understanding**, and **code generator**) to interview you with cross-questions and build your custom Google ADK agent.\n\nTell me: What kind of agent would you like to build? (e.g. *"Create a local attendance manager"* or *"Build an offline flight booking coordinator"*).`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        currentDecisionGroup: null,
        builderJourney: null,
        spec: JSON.parse(JSON.stringify(DEFAULT_MOCK_SPEC)),
        isChatLoading: false
      });
    } catch (err) {
      console.error('Error creating new session:', err);
      set({ isChatLoading: false });
    }
  },

  startNewSandboxSession: async (agentAppName?: string) => {
    const app = agentAppName || get().selectedAgent?.appName || 'agent_builder';
    const sid = await api.createSession(app);
    const agentName = get().selectedAgent?.name || app;
    set({
      sandboxSessionId: sid,
      sandboxMessages: [
        {
          id: `sb-welcome-${Date.now()}`,
          sender: 'agent',
          content: `🟢 **Agent Sandbox Online: ${agentName}**\n\nConnected to backend session \`${sid.slice(0, 8)}...\`.\nType a message below to run and test this agent in the local sandbox.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      activeToolTrace: null,
      activeGuardrailTrace: null
    });
  },

  // 3D Node Drawer
  selectedToolNode: null,
  setSelectedToolNode: (tool) => set({ selectedToolNode: tool }),

  // 3D Spec
  spec: JSON.parse(JSON.stringify(DEFAULT_MOCK_SPEC)),
  updateSpec: (partial) => set((state) => ({ spec: { ...state.spec, ...partial } })),

  currentDecisionGroup: null,
  builderJourney: null,

  chatMessages: [
    {
      id: 'msg-welcome-init',
      sender: 'assistant',
      content: `👋 **Google ADK Agent Builder**\n\nReady to build your next AI Agent. What requirements or tools should it have?`,
      timestamp: 'Just now'
    }
  ],
  isChatLoading: false,

  // Real LLM Message Transmission - No Dummy Replies
  sendArchitectMessage: async (content: string, display?: string) => {
    if (!content.trim()) return;

    let sid = get().builderSessionId;
    if (!sid) {
      sid = await api.createSession('agent_builder');
      set({ builderSessionId: sid });
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: display ?? content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg],
      isChatLoading: true,
      isStreaming: true,
      currentAgentPhase: 'orchestrator'
    }));

    try {
      // Direct call to LLM Agent Builder
      const resp = await api.sendBuilderChat(content, sid);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: resp.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        decisionGroup: resp.decisionGroup,
        architectureSpec: resp.architectureSpec
      };

      set((state) => ({
        chatMessages: [...state.chatMessages, assistantMsg],
        isChatLoading: false,
        isStreaming: false,
        currentDecisionGroup: resp.decisionGroup || state.currentDecisionGroup,
        builderJourney: resp.journey ?? state.builderJourney,
        spec: resp.extractedSpec ? { ...state.spec, ...resp.extractedSpec } : state.spec
      }));

      // The Builder can generate a project from any chat turn (e.g. "Proceed with defaults"),
      // not only via the decision card, so check for new agents after every reply.
      const added = await get().refreshCreatedAgents();
      if (added.length > 0) {
        const names = added.map((a) => `**${a.name}**`).join(', ');
        set((state) => ({
          isAgentReady: true,
          chatMessages: [...state.chatMessages, {
            id: `msg-agent-ready-${Date.now()}`,
            sender: 'assistant' as const,
            content: `✅ New agent ${names} is ready and selected in the **Live Sandbox** tab.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]
        }));
      }
    } catch (err: any) {
      console.error(err);
      const errMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        content: `⚠️ **Backend Execution Error:**\n${err.message || 'Unable to communicate with agent builder.'}\n\nPlease verify that your Google API Key (GOOGLE_API_KEY) is set in your .env file.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      set((state) => ({
        chatMessages: [...state.chatMessages, errMsg],
        isChatLoading: false,
        isStreaming: false
      }));
    }
  },

  updateDecisionOption: (questionId: string, optionId: string) => {
    set((state) => {
      if (!state.currentDecisionGroup) return state;
      const updatedQuestions = state.currentDecisionGroup.questions.map((q) => {
        if (q.id === questionId) {
          if (q.multiSelect) {
            const current = q.selectedOptions ?? [];
            const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
            return { ...q, selectedOptions: next, selectedOption: next[0] ?? '', isCustom: false };
          }
          return { ...q, selectedOption: optionId, selectedOptions: [optionId], isCustom: false };
        }
        return q;
      });

      const newSpec = { ...state.spec };
      if (questionId.includes('structure') || questionId.includes('architecture')) {
        newSpec.architecture = optionId === 'sub_agents' ? 'sub_agents' : 'coordinator';
      } else if (questionId.includes('storage')) {
        newSpec.storage = optionId === 'sqlite' ? 'sqlite' : 'json';
      } else if (questionId.includes('output')) {
        newSpec.outputFormat = optionId;
      }

      return {
        currentDecisionGroup: {
          ...state.currentDecisionGroup,
          questions: updatedQuestions
        },
        spec: newSpec
      };
    });
  },

  toggleCustomDecision: (questionId: string, isCustom: boolean) => {
    set((state) => {
      if (!state.currentDecisionGroup) return state;
      const updatedQuestions = state.currentDecisionGroup.questions.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            isCustom,
            selectedOption: isCustom ? 'custom' : q.options[0]?.id || ''
          };
        }
        return q;
      });
      return {
        currentDecisionGroup: {
          ...state.currentDecisionGroup,
          questions: updatedQuestions
        }
      };
    });
  },

  setCustomDecisionValue: (questionId: string, val: string) => {
    set((state) => {
      if (!state.currentDecisionGroup) return state;
      const updatedQuestions = state.currentDecisionGroup.questions.map((q) => {
        if (q.id === questionId) {
          return { ...q, customValue: val };
        }
        return q;
      });
      return {
        currentDecisionGroup: {
          ...state.currentDecisionGroup,
          questions: updatedQuestions
        }
      };
    });
  },

  setExtraNotes: (notes: string) => {
    set((state) => {
      if (!state.currentDecisionGroup) return state;
      return {
        currentDecisionGroup: {
          ...state.currentDecisionGroup,
          extraNotes: notes
        }
      };
    });
  },

  applyRecommendedDefaults: () => {
    set((state) => {
      if (!state.currentDecisionGroup) return state;
      const updatedQuestions = state.currentDecisionGroup.questions.map((q) => {
        const recommended = q.options.find((opt) => opt.isRecommended) || q.options[0];
        const allRecommended = q.options.filter((opt) => opt.isRecommended).map((opt) => opt.id);
        return {
          ...q,
          selectedOption: recommended ? recommended.id : q.selectedOption,
          selectedOptions: q.multiSelect && allRecommended.length ? allRecommended : recommended ? [recommended.id] : q.selectedOptions,
          isCustom: false,
          customValue: ''
        };
      });

      return {
        currentDecisionGroup: {
          ...state.currentDecisionGroup,
          questions: updatedQuestions
        }
      };
    });
  },

  isGeneratingAgent: false,
  isAgentReady: false,
  generatedFiles: {},

  submitDecisions: async () => {
    const { currentDecisionGroup, spec, builderSessionId } = get();
    if (!currentDecisionGroup) return;

    set({ isGeneratingAgent: true, isStreaming: true, currentAgentPhase: 'orchestrator' });

    let sid = builderSessionId;
    if (!sid) {
      sid = await api.createSession('agent_builder');
      set({ builderSessionId: sid });
    }

    const decisionsMap: Record<string, string> = {};
    const customMap: Record<string, string> = {};

    currentDecisionGroup.questions.forEach((q) => {
      decisionsMap[q.id] = q.selectedOption;
      if (q.isCustom) {
        customMap[q.id] = q.customValue;
      }
    });

    try {
      const resp = await api.confirmDecisions(sid, {
        decisions: decisionsMap,
        customValues: customMap,
        extraNotes: currentDecisionGroup.extraNotes,
        spec
      });

      // Convert generated files to pending files for streaming display
      const pendingFilesArray = Object.entries(resp.files || {}).map(([path, content]) => ({
        path,
        content: typeof content === 'string' ? content : String(content)
      }));
      set({ pendingFiles: pendingFilesArray, currentAgentPhase: 'codegen' });

      // Wait for file streaming animation to complete (simulate real-time writing)
      const totalChars = pendingFilesArray.reduce((sum, f) => sum + f.content.length, 0);
      const streamingTime = Math.min(Math.max(totalChars * 0.015, 3000), 15000);
      await new Promise(r => setTimeout(r, streamingTime));

      // Mark current decision card as locked/submitted
      const updatedMessages = get().chatMessages.map((m) => {
        if (m.decisionGroup && m.decisionGroup.id === currentDecisionGroup.id) {
          return {
            ...m,
            decisionGroup: { ...m.decisionGroup, isSubmitted: true }
          };
        }
        return m;
      });

      const confirmMsg: ChatMessage = {
        id: `msg-confirmed-${Date.now()}`,
        sender: 'assistant',
        content: `🎉 **Agent Build Complete!**\n${resp.message}\n\n✅ Generated ${pendingFilesArray.length} files\n\nSwitched to **Live Sandbox** tab to run your new agent!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      await get().refreshCreatedAgents();

      set({
        chatMessages: [...updatedMessages, confirmMsg],
        isGeneratingAgent: false,
        isAgentReady: true,
        generatedFiles: resp.files,
        activeTab: 'sandbox',
        tabNonce: Date.now(),
        isStreaming: false,
        pendingFiles: []
      });
    } catch (err: any) {
      console.error(err);
      set({ isGeneratingAgent: false, isStreaming: false, pendingFiles: [] });
    }
  },

  // Inspector & Files
  currentAgentFiles: {},
  selectedFilePath: '',
  setSelectedFilePath: (p) => set({ selectedFilePath: p }),

  loadAgentFiles: async (agentName: string) => {
    const files = await api.fetchAgentFiles(agentName);
    const keys = Object.keys(files);
    set({
      currentAgentFiles: files,
      selectedFilePath: keys.length > 0 ? keys[0] : ''
    });
  },

  saveAgentFile: async (filePath: string, content: string) => {
    const { selectedAgent } = get();
    if (!selectedAgent) throw new Error('No agent selected to update');
    const res = await api.saveAgentFile(selectedAgent.name, filePath, content);
    await get().loadAgentFiles(selectedAgent.name);
    return res;
  },

  // Sandbox State - 100% Real LLM Replies
  sandboxMessages: [],
  isSandboxLoading: false,
  activeToolTrace: null,
  activeGuardrailTrace: null,

  sendSandboxMessage: async (content: string) => {
    if (!content.trim()) return;

    const { selectedAgent, selectedAgentEnv } = get();
    const appName = selectedAgent ? selectedAgent.appName : 'agent_builder';

    // Verify particular agent's .env has key before running
    if (selectedAgent) {
      let agentEnv = selectedAgentEnv;
      if (!agentEnv || agentEnv.agentName !== selectedAgent.name) {
        agentEnv = await get().checkSelectedAgentEnv(selectedAgent.name);
      }

      if (!agentEnv?.hasKey) {
        // Must configure API key first
        set({ showAgentEnvModal: true });
        const warnMsg: SandboxChatMessage = {
          id: `sb-warn-${Date.now()}`,
          sender: 'system',
          content: `⚠️ **Google API Key Required:** Please configure the Google API Key for **${selectedAgent.name}** before running it. The key will be saved directly into its \`.env\` file without any LLM interaction.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        set((state) => ({
          sandboxMessages: [...state.sandboxMessages, warnMsg]
        }));
        return;
      }
    }

    let sid = get().sandboxSessionId;
    if (!sid) {
      sid = await api.createSession(appName);
      set({ sandboxSessionId: sid });
    }

    const userMsg: SandboxChatMessage = {
      id: `sb-user-${Date.now()}`,
      sender: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    set((state) => ({
      sandboxMessages: [...state.sandboxMessages, userMsg],
      isSandboxLoading: true,
      activeToolTrace: null,
      activeGuardrailTrace: null
    }));

    try {
      // Real backend LLM run
      const resp = await api.sendRuntimeChat(appName, sid, content);

      if (resp.toolCalls && resp.toolCalls.length > 0) {
        for (const tc of resp.toolCalls) {
          set({ activeToolTrace: tc.toolName });
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (resp.guardrailTriggered) {
        set({ activeGuardrailTrace: resp.guardrailTriggered.rule });
      }

      const agentMsg: SandboxChatMessage = {
        id: `sb-agent-${Date.now()}`,
        sender: 'agent',
        content: resp.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: resp.toolCalls,
        guardrailTriggered: resp.guardrailTriggered,
        cardPayload: resp.cardPayload
      };

      set((state) => ({
        sandboxMessages: [...state.sandboxMessages, agentMsg],
        isSandboxLoading: false
      }));

      setTimeout(() => {
        set({ activeToolTrace: null, activeGuardrailTrace: null });
      }, 3500);
    } catch (err: any) {
      console.error(err);
      const errMsg: SandboxChatMessage = {
        id: `sb-err-${Date.now()}`,
        sender: 'system',
        content: `⚠️ **Agent Execution Error:** ${err.message || 'Execution failed.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      set((state) => ({
        sandboxMessages: [...state.sandboxMessages, errMsg],
        isSandboxLoading: false
      }));
    }
  },

  resetSandbox: () => {
    get().startNewSandboxSession();
  },

  resetDemoToInitial: () => {
    get().startNewBuilderSession();
  },

  // Streaming & File Writing State
  isStreaming: false,
  streamingText: '',
  currentAgentPhase: 'orchestrator',
  fileWriteEvents: [],
  agentEvents: [],
  pendingFiles: [],

  setStreamingState: (isStreaming, text) => set({ isStreaming, streamingText: text || '' }),
  setCurrentAgentPhase: (phase) => set({ currentAgentPhase: phase }),
  addFileWriteEvent: (event) => set(s => ({ fileWriteEvents: [...s.fileWriteEvents, event] })),
  addAgentEvent: (event) => set(s => ({ agentEvents: [...s.agentEvents, event] })),
  setPendingFiles: (files) => set({ pendingFiles: files }),
  clearStreamingState: () => set({
    isStreaming: false,
    streamingText: '',
    currentAgentPhase: 'orchestrator',
    fileWriteEvents: [],
    agentEvents: [],
    pendingFiles: []
  })
}));
