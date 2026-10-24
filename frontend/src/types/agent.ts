export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, string>;
  returns: string;
  status?: 'idle' | 'calling' | 'success' | 'error';
  color?: string;
}

export interface GuardrailRule {
  id: string;
  name: string;
  description: string;
  type: 'input' | 'output' | 'safety';
  active: boolean;
}

export interface SubAgentNode {
  id: string;
  name: string;
  role: string;
  color: string;
  tools: string[];
}

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
  isRecommended?: boolean;
}

export interface DecisionQuestion {
  id: string;
  title: string;
  description?: string;
  options: DecisionOption[];
  selectedOption: string;
  isCustom: boolean;
  customValue: string;
  /** Structured decisions from the Builder (pending_decisions). */
  why?: string;
  category?: string;
  multiSelect?: boolean;
  selectedOptions?: string[];
  allowCustom?: boolean;
}

export interface DecisionGroup {
  id: string;
  title: string;
  description?: string;
  questions: DecisionQuestion[];
  extraNotes?: string;
  isSubmitted?: boolean;
  /** True when built from the Builder's structured pending_decisions (answers go back as DECISIONS_JSON). */
  structured?: boolean;
  round?: number;
  /** Interview step this card belongs to ("Step 3 of 7 · Architecture & topology"). */
  step?: InterviewStepRef;
}

export interface InterviewStepRef {
  key: string;
  number: number;
  total: number;
  title: string;
  phase: string;
}

/** The Builder's `build_phase` state: where the guided interview / build currently is. */
export interface BuilderJourney {
  stepIndex: number;
  total: number;
  completed: string[];
  approved: boolean;
  phase: string;
  /** 0-5 across design validation → deliver once the spec is approved; null before. */
  buildStage: number | null;
  steps: { key: string; title: string; phase: string }[];
}

/** Phase 4 output: the compiled Agent Architecture Specification. */
export interface ArchitectureSpec {
  project: string;
  markdown: string;
  leadSystemPrompt: string;
  config: Record<string, unknown>;
  enabledModules: string[];
}

export interface ExtractedAgentSpec {
  goal: string;
  tools: AgentTool[];
  guardrails: GuardrailRule[];
  architecture: 'coordinator' | 'sub_agents';
  storage: 'sqlite' | 'json' | string;
  dataSource: 'ready_dataset' | 'mock_data' | string;
  outputFormat: 'plain_text' | 'json' | 'both' | string;
  subAgents: SubAgentNode[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  decisionGroup?: DecisionGroup;
  architectureSpec?: ArchitectureSpec;
  structuredInfo?: {
    goal?: string;
    tools?: string[];
    guardrails?: string[];
    architecture?: string;
  };
}

export interface SandboxChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: {
    toolName: string;
    params: Record<string, any>;
    result?: any;
    durationMs?: number;
  }[];
  guardrailTriggered?: {
    rule: string;
    reason: string;
    action: 'blocked' | 'sanitized' | 'warned';
  };
  cardPayload?: any;
}

export interface CreatedAgent {
  name: string;
  appName: string;
  path: string;
  files: string[];
  promptPreview: string;
  hasAgentPy: boolean;
  lastModified: string;
}

export interface EnvConfig {
  hasKey: boolean;
  apiKey: string;
  apiBase?: string;
  model?: string;
  envExists: boolean;
}

export interface AgentEnvConfig {
  agentName: string;
  hasKey: boolean;
  apiKey: string;
  apiBase?: string;
  model?: string;
  agentEnvExists: boolean;
  envPath: string;
}

// Streaming Types
export interface StreamingChunk {
  type: 'text' | 'thinking' | 'tool_call' | 'tool_result' | 'file_write' | 'agent_switch' | 'complete';
  content?: string;
  agent?: string;
  tool?: string;
  filePath?: string;
  fileContent?: string;
  timestamp?: number;
}

export interface FileWriteEvent {
  path: string;
  content: string;
  status: 'writing' | 'complete';
  linesWritten: number;
  totalLines: number;
}

export interface AgentEvent {
  agent: string;
  action: string;
  status: 'started' | 'thinking' | 'executing' | 'complete';
  timestamp: number;
}
