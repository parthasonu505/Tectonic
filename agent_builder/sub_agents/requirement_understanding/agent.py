"""Sub-Agent 2: builds detailed technical and architectural specifications through continuous elicitation."""

from google.adk.agents import LlmAgent
from google.adk.agents.readonly_context import ReadonlyContext

from ...shared_libraries.constants import (
    MODEL,
    STATE_GUARDRAIL_REPORT,
    STATE_INTENT,
    STATE_NOTES,
    STATE_REQUIREMENTS,
)
from ...shared_libraries.types import Requirements
from ...tools.memory import render_state_block
from ...tracing import TRACE_CALLBACKS
from . import prompt


def _instruction(context: ReadonlyContext) -> str:
    return prompt.REQUIREMENTS_PROMPT + render_state_block(
        context, (STATE_INTENT, STATE_REQUIREMENTS, STATE_NOTES, STATE_GUARDRAIL_REPORT)
    )


requirement_understanding_agent = LlmAgent(
    name="requirement_understanding",
    model=MODEL,
    description=(
        "Interactively elicits and clarifies user requirements by asking questions across turns until "
        "all details are known, then outputs a complete technical specification."
    ),
    instruction=_instruction,
    output_schema=Requirements,
    output_key=STATE_REQUIREMENTS,
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
    **TRACE_CALLBACKS,
)
