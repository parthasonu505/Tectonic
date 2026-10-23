import type { 
  ExtractedAgentSpec, 
  DecisionGroup, 
  DecisionQuestion, 
  DecisionOption,
  CreatedAgent, 
  EnvConfig 
} from '../types/agent';

export interface ChatResponse {
  reply: string;
  decisionGroup?: DecisionGroup;
  extractedSpec?: Partial<ExtractedAgentSpec>;
  isComplete?: boolean;
}

export interface ConfirmPayload {
  decisions: Record<string, string>;
  customValues: Record<string, string>;
  extraNotes?: string;
  spec: ExtractedAgentSpec;
}

export interface RuntimeChatResponse {
  reply: string;
  toolCalls?: {
    toolName: string;
    params: Record<string, any>;
    result: any;
    durationMs: number;
  }[];
  guardrailTriggered?: {
    rule: string;
    reason: string;
    action: 'blocked' | 'sanitized' | 'warned';
  };
  cardPayload?: any;
}

// Fallback Spec for demo
export const DEFAULT_MOCK_SPEC: ExtractedAgentSpec = {
  goal: 'An intelligent AI assistant built with Google ADK powered by Google Gemini (gemini-3.6-flash).',
  tools: [
    {
      name: 'core_process',
      description: 'Execute core domain workflow and validation.',
      parameters: { query: 'string' },
      returns: 'Execution status and response payload',
      color: '#38bdf8'
    }
  ],
  guardrails: [
    {
      id: 'g-pii',
      name: 'Deterministic PII/Sensitive Sanitization',
      description: 'Zero-LLM regex inspection for credentials, tokens and sensitive info.',
      type: 'input',
      active: true
    },
    {
      id: 'g-safety',
      name: 'Safety & Authorization Gate',
      description: 'Enforces user confirmation before critical state modifications.',
      type: 'safety',
      active: true
    }
  ],
  architecture: 'coordinator',
  storage: 'sqlite',
  dataSource: 'mock_data',
  outputFormat: 'both',
  subAgents: []
};

export const DEFAULT_DECISION_GROUP: DecisionGroup = {
  id: 'decisions-init',
  title: 'Open Decisions & Agent Architecture',
  description: 'The Meta-Agent requires your architectural preferences before generating the executable ADK code.',
  questions: [
    {
      id: 'storage_method',
      title: 'Local Storage Method',
      description: 'Where should persistent records be stored locally?',
      selectedOption: 'sqlite',
      isCustom: false,
      customValue: '',
      options: [
        { id: 'sqlite', label: 'SQLite DB (Relational & ACID Compliant)', isRecommended: true },
        { id: 'json_files', label: 'JSON Files (Lightweight Flat Storage)' }
      ]
    },
    {
      id: 'agent_structure',
      title: 'Agent Architecture',
      description: 'Coordinator vs Modular Multi-Agent sub-delegation hierarchy',
      selectedOption: 'coordinator',
      isCustom: false,
      customValue: '',
      options: [
        { id: 'coordinator', label: 'Single Coordinator Agent (Lean & fast)', isRecommended: true },
        { id: 'sub_agents', label: 'Coordinator + Specialized Sub-Agents' }
      ]
    }
  ]
};

class ApiService {
  private isMockMode: boolean = false;

  constructor() {
    const saved = localStorage.getItem('agent_studio_mock_mode');
    // Default to false: USE REAL BACKEND
    this.isMockMode = saved !== null ? saved === 'true' : false;
  }

  public setMockMode(enabled: boolean) {
    this.isMockMode = enabled;
    localStorage.setItem('agent_studio_mock_mode', String(enabled));
  }

  public getMockMode(): boolean {
    return this.isMockMode;
  }

  // --- Environment & API Key Management (Zero LLM Interaction) ---
  public async getEnvConfig(): Promise<EnvConfig> {
    try {
      const res = await fetch('/api/env');
      if (!res.ok) throw new Error('Failed to read environment config');
      return await res.json();
    } catch {
      return { hasKey: false, apiKey: '', model: 'gemini-3.6-flash', envExists: false };
    }
  }

  public async saveEnvConfig(apiKey: string, model: string = 'gemini-3.6-flash'): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model })
    });
    if (!res.ok) {
      throw new Error('Failed to save .env configuration');
    }
    return await res.json();
  }

  // --- Session Management ---
  public async createSession(appName: string = 'agent_builder', userId: string = 'default_user'): Promise<string> {
    if (this.isMockMode) {
      return `mock-session-${Date.now()}`;
    }
    try {
      const res = await fetch(`/apps/${appName}/users/${userId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        throw new Error(`Session creation failed: HTTP ${res.status}`);
      }
      const data = await res.json();
      return data.id;
    } catch (err) {
      console.warn('Fallback to local session id on error:', err);
      return `session-${Date.now()}`;
    }
  }

  // --- Agent Builder Chat (Real ADK Backend) ---
  public async sendBuilderChat(message: string, sessionId: string, userId: string = 'default_user'): Promise<ChatResponse> {
    if (this.isMockMode) {
      await new Promise(r => setTimeout(r, 600));
      return {
        reply: `### Blueprint Recap\nIdentified requirement for "${message}". Review the design options below:`,
        decisionGroup: JSON.parse(JSON.stringify(DEFAULT_DECISION_GROUP)),
        extractedSpec: DEFAULT_MOCK_SPEC
      };
    }

    const payload = {
      appName: 'agent_builder',
      userId,
      sessionId,
      newMessage: {
        role: 'user',
        parts: [{ text: message }]
      }
    };

    const res = await fetch('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ADK Backend error ${res.status}: ${errText}`);
    }

    const events: any[] = await res.json();
    return this.parseBuilderEvents(events);
  }

  // --- Parse ADK Events from Agent Builder ---
  private parseBuilderEvents(events: any[]): ChatResponse {
    let replyText = '';
    let extractedRequirements: any = null;

    // Scan events in reverse or collect relevant parts
    for (const event of events) {
      if (event.content && Array.isArray(event.content.parts)) {
        // Collect model response text (ignore thoughts or debug)
        const visibleParts = event.content.parts
          .filter((p: any) => !p.thought && typeof p.text === 'string')
          .map((p: any) => p.text);
        if (visibleParts.length > 0) {
          replyText = visibleParts.join('\n\n');
        } else {
          // If all were thought, fallback to any text
          const allParts = event.content.parts
            .filter((p: any) => typeof p.text === 'string')
            .map((p: any) => p.text);
          if (allParts.length > 0 && !replyText) {
            replyText = allParts.join('\n\n');
          }
        }
      }

      // Check actions.stateDelta for requirements, tools, guardrails, open_questions
      if (event.actions?.stateDelta) {
        if (event.actions.stateDelta.requirements) {
          extractedRequirements = event.actions.stateDelta.requirements;
        }
      }
    }

    if (!replyText) {
      replyText = 'Agent builder processed your request.';
    }

    // Build DecisionGroup from extractedRequirements or text checkboxes
    const decisionGroup = this.extractDecisionGroup(extractedRequirements, replyText);

    // Build ExtractedAgentSpec for 3D visualizer
    const extractedSpec: Partial<ExtractedAgentSpec> = {};
    if (extractedRequirements) {
      if (extractedRequirements.goal) {
        extractedSpec.goal = extractedRequirements.goal;
      }
      if (Array.isArray(extractedRequirements.tools)) {
        extractedSpec.tools = extractedRequirements.tools.map((t: any, idx: number) => ({
          name: typeof t === 'string' ? t : t.name || `tool_${idx + 1}`,
          description: t.description || 'Custom Agent Tool',
          parameters: t.parameters || {},
          returns: t.returns || 'result',
          color: ['#38bdf8', '#818cf8', '#a855f7', '#10b981', '#f59e0b'][idx % 5]
        }));
      }
      if (Array.isArray(extractedRequirements.guardrails)) {
        extractedSpec.guardrails = extractedRequirements.guardrails.map((g: any, idx: number) => ({
          id: `g-${idx}`,
          name: typeof g === 'string' ? g : g.name || 'Safety Rule',
          description: typeof g === 'string' ? g : g.description || 'Enforced Guardrail',
          type: 'safety',
          active: true
        }));
      }
    }

    return {
      reply: replyText,
      decisionGroup,
      extractedSpec: Object.keys(extractedSpec).length > 0 ? extractedSpec : undefined,
      isComplete: extractedRequirements?.is_complete || false
    };
  }

  // Parse open_questions and questions_for_user into DecisionGroup
  private extractDecisionGroup(requirements: any, replyText: string): DecisionGroup | undefined {
    const rawBlocks: string[] = [];
    const singleLines: string[] = [];

    // Helper to extract options from a multi-line block
    const parseBlockOptions = (blockText: string, qIdx: number): DecisionQuestion | null => {
      const lines = blockText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return null;

      const rawTitle = lines[0]
        .replace(/^#{1,4}\s+/, '')
        .replace(/^\d+[\.\)\s]+/, '')
        .replace(/^[-*•\s]+/, '')
        .replace(/[:?]+$/, '')
        .trim();
      const title = rawTitle || `Preference Question ${qIdx + 1}`;

      const options: DecisionOption[] = [];
      let defaultSelected = '';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Match "- [ ] A) ...", "- [x] A) ...", "A) ...", "1) ...", or "* A) ..."
        const match = line.match(/^(?:[-*•]\s*)?(?:\[\s*[xX ]?\s*\]\s*)?(?:\*\*)?([A-Za-z0-9])[\.\)]\s*(.*)$/);
        if (match) {
          const optLetter = match[1].toUpperCase();
          const rest = match[2].replace(/\*\*/g, '').trim();
          if (!rest) continue;

          const isRec = rest.toLowerCase().includes('(recommended)') || rest.toLowerCase().includes('recommended');
          options.push({
            id: optLetter,
            label: `${optLetter}) ${rest}`,
            isRecommended: isRec
          });

          if (isRec && !defaultSelected) {
            defaultSelected = optLetter;
          }
        }
      }

      if (options.length >= 2) {
        if (!defaultSelected) defaultSelected = options[0].id;
        return {
          id: `q_${qIdx}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`,
          title,
          options,
          selectedOption: defaultSelected,
          isCustom: false,
          customValue: ''
        };
      }
      return null;
    };

    // Helper to parse single-line questions with 'or' / 'vs' (e.g. 'Local storage method – SQLite DB or JSON files?')
    const parseSingleLineChoice = (line: string, qIdx: number): DecisionQuestion | null => {
      const clean = line.replace(/^[-*•\s]+/, '').replace(/^\d+[\.\)]\s*/, '').trim();
      const sepIdx = clean.search(/[:–—\-]\s+/);
      if (sepIdx !== -1) {
        const title = clean.substring(0, sepIdx).replace(/\*\*/g, '').trim();
        const optPart = clean.substring(sepIdx + 1).replace(/^[:–—\-]\s*/, '').replace(/\?$/, '').trim();

        // Split by ' or ', ', or ', or commas
        const rawOpts = optPart.split(/(?:,\s*or\s+|\s+or\s+|,\s*)/i).map(s => s.trim().replace(/^either\s+/i, '')).filter(Boolean);
        if (rawOpts.length >= 2) {
          const options: DecisionOption[] = rawOpts.map((opt, oIdx) => {
            const letter = String.fromCharCode(65 + oIdx);
            const isRec = oIdx === 0 || opt.toLowerCase().includes('recommended');
            return {
              id: letter,
              label: `${letter}) ${opt}`,
              isRecommended: isRec
            };
          });

          return {
            id: `q_${qIdx}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`,
            title,
            options,
            selectedOption: options[0].id,
            isCustom: false,
            customValue: ''
          };
        }
      }
      return null;
    };

    // 1. Gather from requirements.questions_for_user or open_questions
    if (requirements?.questions_for_user && Array.isArray(requirements.questions_for_user) && requirements.questions_for_user.length > 0) {
      requirements.questions_for_user.forEach((item: any) => {
        if (typeof item === 'string') {
          if (item.includes('\n')) rawBlocks.push(item);
          else singleLines.push(item);
        }
      });
    }

    if (requirements?.open_questions && Array.isArray(requirements.open_questions) && requirements.open_questions.length > 0) {
      requirements.open_questions.forEach((item: any) => {
        if (typeof item === 'string') {
          if (item.includes('\n')) rawBlocks.push(item);
          else singleLines.push(item);
        }
      });
    }

    // 2. If nothing from requirements, parse from replyText
    if (rawBlocks.length === 0 && singleLines.length === 0 && replyText) {
      if (replyText.includes('[ ]') || replyText.includes('[x]')) {
        const sections = replyText.split(/(?=(?:#{2,4}\s+|^\d+[\.\)]\s+)[^\n]+)/m);
        for (const sec of sections) {
          if (sec.includes('[ ]') || sec.includes('[x]')) {
            rawBlocks.push(sec.trim());
          }
        }
      }

      // Also check for bulleted questions or Open Decisions sections
      const lines = replyText.split('\n');
      let inDecisionSection = false;
      for (const l of lines) {
        const trimmed = l.trim();
        if (trimmed.match(/open decision|please help us finalize|help us finalize|questions? for you|preferences?:/i)) {
          inDecisionSection = true;
          continue;
        }
        if (inDecisionSection || trimmed.match(/^(?:[-*•]|\d+[\.\)])\s+.*[–—\-:]\s+.*(?:\bor\b|\?)/i)) {
          if (trimmed.match(/^(?:[-*•]|\d+[\.\)])\s+/)) {
            singleLines.push(trimmed);
          } else if (trimmed === '' && singleLines.length > 0) {
            inDecisionSection = false;
          }
        }
      }
    }

    const questions: DecisionQuestion[] = [];
    let qIdx = 0;

    // Process blocks
    for (const block of rawBlocks) {
      const q = parseBlockOptions(block, qIdx++);
      if (q) questions.push(q);
    }

    // Process single lines
    for (const sLine of singleLines) {
      const q = parseSingleLineChoice(sLine, qIdx++);
      if (q) questions.push(q);
    }

    if (questions.length === 0) return undefined;

    return {
      id: `dg-${Date.now()}`,
      title: 'Architectural Preferences & Open Decisions',
      description: 'Select your preferred option for each question below using the checkboxes:',
      questions
    };
  }

  // --- Run Created Agent in Live Sandbox ---
  public async sendRuntimeChat(
    appName: string,
    sessionId: string,
    message: string,
    userId: string = 'default_user'
  ): Promise<RuntimeChatResponse> {
    if (this.isMockMode) {
      await new Promise(r => setTimeout(r, 600));
      return {
        reply: `[Mock Response for ${appName}]: Processed "${message}"`,
        toolCalls: [
          {
            toolName: 'execute_action',
            params: { query: message },
            result: { status: 'success' },
            durationMs: 45
          }
        ]
      };
    }

    const payload = {
      appName,
      userId,
      sessionId,
      newMessage: {
        role: 'user',
        parts: [{ text: message }]
      }
    };

    const res = await fetch('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Agent execution error ${res.status}: ${errText}`);
    }

    const events: any[] = await res.json();
    let reply = '';
    const toolCalls: any[] = [];
    let guardrailTriggered: any = null;

    for (const event of events) {
      // Collect message reply
      if (event.content && Array.isArray(event.content.parts)) {
        const partsText = event.content.parts
          .filter((p: any) => !p.thought && typeof p.text === 'string')
          .map((p: any) => p.text);
        if (partsText.length > 0) {
          reply = partsText.join('\n\n');
        } else {
          const all = event.content.parts
            .filter((p: any) => typeof p.text === 'string')
            .map((p: any) => p.text);
          if (all.length > 0 && !reply) {
            reply = all.join('\n\n');
          }
        }
      }

      // Check for guardrails intervention
      if (event.author === 'guardrails' || (event.nodeInfo?.path && event.nodeInfo.path.includes('guardrails'))) {
        guardrailTriggered = {
          rule: 'Guardrails Filter Active',
          reason: 'Input passed through safety sanitization checks.',
          action: 'sanitized'
        };
      }

      // Check for tool execution events
      if (event.author && event.author !== appName && event.author !== 'user') {
        toolCalls.push({
          toolName: event.author,
          params: event.actions?.stateDelta || {},
          result: event.output || 'Executed',
          durationMs: 40
        });
      }
    }

    if (!reply) {
      reply = `Agent completed execution.`;
    }

    return {
      reply,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      guardrailTriggered
    };
  }

  // --- Confirm decisions and generate agent ---
  public async confirmDecisions(
    sessionId: string,
    payload: ConfirmPayload,
    userId: string = 'default_user'
  ): Promise<{ success: boolean; files: Record<string, string>; message: string }> {
    // Send formatted response to agent_builder to generate the project
    const choicesSummary = Object.entries(payload.decisions)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const prompt = `Proceed with following finalized choices:\n${choicesSummary}\n${payload.extraNotes ? `Notes: ${payload.extraNotes}\n` : ''}Please build and generate the complete agent files now.`;

    const chatResp = await this.sendBuilderChat(prompt, sessionId, userId);

    // Refresh generated agents
    const agents = await this.fetchCreatedAgents();
    const latestAgent = agents[0];
    let files: Record<string, string> = {};
    if (latestAgent) {
      files = await this.fetchAgentFiles(latestAgent.name);
    }

    return {
      success: true,
      message: chatResp.reply || 'Agent generated successfully!',
      files
    };
  }

  // --- System Agents Discovery & Code Updates ---
  public async fetchCreatedAgents(): Promise<CreatedAgent[]> {
    try {
      const res = await fetch('/api/system/agents');
      if (!res.ok) return [];
      const data = await res.json();
      const agents: CreatedAgent[] = data.agents || [];
      // Newest first: callers treat agents[0] as the most recently generated project.
      return agents.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    } catch {
      return [];
    }
  }

  public async fetchAgentFiles(agentName: string): Promise<Record<string, string>> {
    try {
      const res = await fetch(`/api/system/agents/${agentName}/files`);
      if (!res.ok) return {};
      const data = await res.json();
      return data.files || {};
    } catch {
      return {};
    }
  }

  public async saveAgentFile(agentName: string, filePath: string, content: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/system/agents/${agentName}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update file');
    }
    return await res.json();
  }

  // --- Specific Agent Environment Configuration (Zero-LLM Direct Write) ---
  public async getAgentEnv(agentName: string): Promise<import('../types/agent').AgentEnvConfig> {
    const res = await fetch(`/api/system/agents/${agentName}/env`);
    if (!res.ok) throw new Error(`Failed to fetch env for ${agentName}`);
    return await res.json();
  }

  public async saveAgentEnv(
    agentName: string, 
    apiKey: string, 
    model: string = 'gemini-3.6-flash'
  ): Promise<{ success: boolean; message: string; envPath: string }> {
    const res = await fetch(`/api/system/agents/${agentName}/env`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to configure .env for ${agentName}`);
    }
    return await res.json();
  }
}

export const api = new ApiService();
