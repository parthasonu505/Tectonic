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
}

export interface DecisionGroup {
  id: string;
  title: string;
  description?: string;
  questions: DecisionQuestion[];
  extraNotes?: string;
  isSubmitted?: boolean;
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
