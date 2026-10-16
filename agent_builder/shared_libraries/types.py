"""Pydantic schemas shared by every agent: Intent, Requirements, Guardrails and Agent Cards."""

import json
import keyword
import re
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .constants import MODEL_NAME

IDENTIFIER_RE = re.compile(r"^[a-z][a-z0-9_]{1,48}$")


def slugify_identifier(value: str, default: str = "agent") -> str:
    """Turn arbitrary text into a safe lowercase Python identifier."""
    slug = re.sub(r"[^a-z0-9_]+", "_", str(value).strip().lower()).strip("_")
    if not slug:
        slug = default
    if not slug[0].isalpha():
        slug = f"a_{slug}"
    slug = slug[:48]
    if keyword.iskeyword(slug):
        slug = f"{slug}_agent"
    if len(slug) < 2:
        slug = f"{slug}_agent"
    return slug


def parse_json_loose(text: Any) -> Any:
    """Parse JSON that may be wrapped in markdown fences or surrounding prose."""
    if isinstance(text, (dict, list)):
        return text
    raw = str(text).strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    starts = [i for i in (raw.find("{"), raw.find("[")) if i != -1]
    if not starts:
        raise ValueError("No JSON object or array found in text.")
    start = min(starts)
    closer = "}" if raw[start] == "{" else "]"
    end = raw.rfind(closer)
    if end <= start:
        raise ValueError("Unterminated JSON in text.")
    return json.loads(raw[start : end + 1])


# --- Intent ----------------------------------------------------------------
class IntentCategory(str, Enum):
    CREATE_AGENT = "create_agent"
    MODIFY_AGENT = "modify_agent"
    PROVIDE_REQUIREMENTS = "provide_requirements"
    EXPLAIN_OR_HELP = "explain_or_help"
    OUT_OF_SCOPE = "out_of_scope"
    NEEDS_CLARIFICATION = "needs_clarification"


class Intent(BaseModel):
    category: IntentCategory = Field(description="Classification of the user's request.")
    summary: str = Field(description="One or two sentence restatement of what the user wants or answered.")
    agent_name_suggestion: str = Field(default="", description="snake_case project name.")
    domain: str = Field(default="", description="Problem domain, e.g. travel, finance, support.")
    entities: list[str] = Field(default_factory=list, description="Key nouns: data sources, systems, people.")
    capabilities_requested: list[str] = Field(default_factory=list)
    tools_mentioned: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    ambiguities: list[str] = Field(default_factory=list, description="Questions that must be answered before design.")
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


# --- Requirements ------------------------------------------------------------
class ToolParameter(BaseModel):
    name: str
    type: str = Field(default="str", description="Python type hint: str, int, float, bool, list[str].")
    description: str = ""
    required: bool = True

    @model_validator(mode="before")
    @classmethod
    def _coerce_param(cls, val: Any) -> Any:
        if isinstance(val, str):
            return {"name": val, "type": "str"}
        return val


class ToolSpec(BaseModel):
    name: str = "tool"
    description: str = ""
    module: str = Field(default="custom_tools", description="File name (no .py) inside the generated tools/ package.")
    parameters: list[ToolParameter] = Field(default_factory=list)
    returns: str = Field(default="dict with a 'status' key", description="What the tool returns.")
    requires_network: bool = False
    requires_filesystem: bool = False

    @field_validator("name", "module", mode="before")
    @classmethod
    def _slug(cls, value: Any) -> str:
        return slugify_identifier(value, default="tool")

    @field_validator("parameters", mode="before")
    @classmethod
    def _coerce_parameters(cls, val: Any) -> Any:
        if isinstance(val, dict):
            # Converts {'user_id': 'str', 'timestamp': 'str'} -> list of ToolParameter dicts
            return [
                {
                    "name": k,
                    "type": str(v) if not isinstance(v, dict) else v.get("type", "str"),
                    "description": "",
                    "required": True,
                }
                for k, v in val.items()
            ]
        if isinstance(val, list):
            res = []
            for item in val:
                if isinstance(item, str):
                    res.append({"name": item, "type": "str", "required": True})
                elif isinstance(item, dict):
                    res.append(item)
            return res
        return []

    @field_validator("returns", mode="before")
    @classmethod
    def _coerce_returns(cls, val: Any) -> Any:
        if isinstance(val, dict):
            # Converts {'status': 'bool', 'message': 'str'} -> 'dict with status: bool, message: str'
            items = ", ".join(f"{k}: {v}" for k, v in val.items())
            return f"dict with {items}"
        if val is None:
            return "dict with a 'status' key"
        return str(val)


AgentType = Literal["llm", "sequential", "parallel", "loop"]


class SubAgentSpec(BaseModel):
    name: str = "root_agent"
    role: str = Field(default="", description="Short role title.")
    description: str = Field(default="", description="One sentence used by a parent agent to decide when to delegate.")
    instruction_outline: str = Field(default="", description="Bullet-style outline of the agent's behaviour.")
    tools: list[str] = Field(default_factory=list, description="Names of tools from Requirements.tools.")
    output_key: str = Field(default="", description="Session-state key this agent writes its result to.")
    agent_type: AgentType = "llm"

    @model_validator(mode="before")
    @classmethod
    def _coerce_sub_agent(cls, val: Any) -> Any:
        if isinstance(val, str):
            val = {"name": val}
        if isinstance(val, dict):
            data = dict(val)
            name = data.get("name") or "agent"
            if not data.get("role"):
                clean_name = str(name).replace("_", " ").title()
                data["role"] = f"{clean_name} Role"
            if not data.get("description"):
                clean_name = str(name).replace("_", " ")
                data["description"] = f"Agent responsible for {clean_name}."
            if "tools" in data and isinstance(data["tools"], dict):
                data["tools"] = list(data["tools"].keys())
            return data
        return val

    @field_validator("name", mode="before")
    @classmethod
    def _slug(cls, value: Any) -> str:
        return slugify_identifier(value)


class Requirements(BaseModel):
    project_name: str = "generated_agent"
    goal: str = ""
    target_users: str = ""
    architecture: Literal["single", "coordinator", "sequential", "parallel", "loop"] = "coordinator"
    root_agent: SubAgentSpec = Field(
        default_factory=lambda: SubAgentSpec(name="root_agent", role="Root Agent", description="Primary coordinator agent.")
    )
    sub_agents: list[SubAgentSpec] = Field(default_factory=list)
    tools: list[ToolSpec] = Field(default_factory=list)
    state_keys: list[str] = Field(default_factory=list)
    inputs: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    extra_requirements: list[str] = Field(default_factory=list, description="Additional pip packages.")
    guardrail_requirements: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list, description="Remaining open questions or unknown details.")
    questions_for_user: list[str] = Field(
        default_factory=list,
        description="Targeted questions to ask the user right now to gather and clarify missing requirements. Empty only when all requirements are fully known.",
    )
    is_complete: bool = False
    collected_details_summary: str = ""

    @model_validator(mode="before")
    @classmethod
    def _coerce_requirements(cls, val: Any) -> Any:
        if not isinstance(val, dict):
            return val
        data = dict(val)
        p_name = data.get("project_name", "agent_system")
        if not data.get("goal"):
            clean_p = str(p_name).replace("_", " ")
            data["goal"] = (
                data.get("summary")
                or data.get("description")
                or data.get("purpose")
                or data.get("collected_details_summary")
                or f"Manage and automate {clean_p} tasks."
            )
        if not data.get("root_agent"):
            data["root_agent"] = {"name": str(p_name)}
        elif isinstance(data["root_agent"], str):
            data["root_agent"] = {"name": data["root_agent"]}
        if data.get("architecture") not in ("single", "coordinator", "sequential", "parallel", "loop"):
            data["architecture"] = "coordinator"
        if isinstance(data.get("tools"), dict):
            data["tools"] = [{"name": k, **(v if isinstance(v, dict) else {})} for k, v in data["tools"].items()]
        return data

    @field_validator("project_name", mode="before")
    @classmethod
    def _slug(cls, value: Any) -> str:
        return slugify_identifier(value, default="generated_agent")


# --- Guardrails --------------------------------------------------------------
class GuardrailFinding(BaseModel):
    severity: Literal["info", "warning", "blocker"] = "info"
    code: str = "GENERAL"
    message: str = ""
    location: str = ""

    @field_validator("severity", mode="before")
    @classmethod
    def _severity(cls, value: Any) -> str:
        text = str(value).strip().lower()
        if text in ("blocker", "block", "error", "critical", "high"):
            return "blocker"
        if text in ("warning", "warn", "medium"):
            return "warning"
        return "info"


class GuardrailReport(BaseModel):
    stage: Literal["request", "design", "code"] = "request"
    approved: bool = False
    summary: str = ""
    findings: list[GuardrailFinding] = Field(default_factory=list)
    required_changes: list[str] = Field(default_factory=list)


# --- Agent Cards -------------------------------------------------------------
class AgentCard(BaseModel):
    name: str
    description: str
    version: str = "0.1.0"
    role: Literal["root", "sub_agent"] = "sub_agent"
    agent_type: AgentType = "llm"
    model: str = MODEL_NAME
    instruction: str = Field(default="", description="Full system prompt for the generated agent.")
    instruction_summary: str = ""
    tools: list[ToolSpec] = Field(default_factory=list)
    sub_agents: list[str] = Field(default_factory=list)
    parent: str = ""
    capabilities: list[str] = Field(default_factory=list)
    state_reads: list[str] = Field(default_factory=list)
    state_writes: list[str] = Field(default_factory=list)
    output_key: str = ""
    max_iterations: int = Field(default=3, ge=1, le=20, description="Only used by loop agents.")
    input_modes: list[str] = Field(default_factory=lambda: ["text"])
    output_modes: list[str] = Field(default_factory=lambda: ["text"])
    guardrails: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def _slug(cls, value: Any) -> str:
        return slugify_identifier(value)


class AgentCardRegistry(BaseModel):
    project_name: str
    cards: list[AgentCard] = Field(default_factory=list)


def fix_requirements_json(raw_text: str) -> str:
    """Ensure raw LLM output is converted into 100% valid, strict JSON matching Requirements schema."""
    try:
        data = parse_json_loose(raw_text)
        obj = Requirements.model_validate(data)
        return obj.model_dump_json()
    except Exception:
        obj = Requirements(
            project_name="generated_agent",
            goal="Manage and automate requested agent workflows.",
            collected_details_summary=str(raw_text)[:500],
            questions_for_user=[
                "Storage & Database:\n- [ ] A) SQLite Database (Recommended) — Structured, relational local storage\n- [ ] B) Local JSON Files — Simple file-based storage\n- [ ] C) Other: [Write your custom database or format]",
                "Key Features & Workflows:\n- [ ] A) Complete Standard Workflow (Recommended) — Includes core operations, data validation, and summaries\n- [ ] B) Lightweight / Minimal — Basic logging only\n- [ ] C) Other: [Specify custom features or workflow]",
            ],
        )
        return obj.model_dump_json()


def fix_intent_json(raw_text: str) -> str:
    """Ensure raw LLM output is converted into 100% valid, strict JSON matching Intent schema."""
    try:
        data = parse_json_loose(raw_text)
        obj = Intent.model_validate(data)
        return obj.model_dump_json()
    except Exception:
        obj = Intent(
            category=IntentCategory.CREATE_AGENT,
            summary=str(raw_text)[:200],
            confidence=0.8,
        )
        return obj.model_dump_json()
