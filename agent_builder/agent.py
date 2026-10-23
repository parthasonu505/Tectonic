"""Root Orchestrator Agent: routes a build request through the five specialist sub-agents."""

from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool

from .prompt import ROOT_PROMPT
from .shared_libraries.constants import MODEL
from .sub_agents.agent_card_manager.agent import agent_card_manager_agent
from .sub_agents.code_generator.agent import code_generator_agent
from .sub_agents.guardrails.agent import guardrails
from .sub_agents.intent_detection.agent import intent_detection_agent
from .sub_agents.requirement_understanding.agent import requirement_understanding_agent
from .tools.file_manager import list_files, read_text_file
from .tools.memory import (
    get_session_summary,
    load_progress,
    persist_progress,
    restore_progress,
    save_progress,
)
from .tools.web_search import web_search
from .tracing import TRACE_CALLBACKS

try:  # shared core-module runtime (tectonic_runtime/); the Builder still runs without it
    from tectonic_runtime.adk_tools import builder_tools
except ImportError:  # pragma: no cover - runtime package absent
    def builder_tools(team: str = "default") -> list:
        return []

root_agent = LlmAgent(
    name="agent_builder",
    model=MODEL,
    description=(
        "Designs and generates runnable local Google ADK agents from a natural-language request: "
        "intent detection, requirements, guardrails, agent cards and code generation."
    ),
    instruction=ROOT_PROMPT,
    tools=[
        AgentTool(agent=intent_detection_agent),
        AgentTool(agent=requirement_understanding_agent),
        guardrails,
        AgentTool(agent=agent_card_manager_agent),
        AgentTool(agent=code_generator_agent),
        get_session_summary,
        load_progress,
        save_progress,
        persist_progress,
        restore_progress,
        read_text_file,
        list_files,
        web_search,
        *builder_tools(),
    ],
    **TRACE_CALLBACKS,
)
