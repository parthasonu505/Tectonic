"""Builder tools for the unified chat: reach every agent in the Studio (and remove generated ones)."""

from __future__ import annotations

from google.adk.tools import ToolContext

from .. import directory


def list_agents() -> dict:
    """List every agent reachable from this chat: the Builder's specialists and every generated project
    with its sub-agents (id, kind, parent, description).

    Returns:
        dict with status and agents.
    """
    agents = [{k: e[k] for k in ("id", "name", "kind", "parent", "description", "deletable")} for e in directory.list_entries()]
    return {"status": "success", "agents": agents}


async def ask_agent(agent: str, message: str, tool_context: ToolContext) -> dict:
    """Send a message to an existing agent and get its answer. Use it whenever the user wants to USE an
    agent that already exists (a generated project, one of its sub-agents, or a Builder specialist)
    instead of building one. The conversation with each agent continues across turns.

    Args:
        agent: The agent id from list_agents ('<project>' or '<project>/<agent>'), or its name.
        message: What to send, in the user's words (complete and self-contained).
        tool_context: Injected by ADK.

    Returns:
        dict with status, agent, reply (show it to the user) and trace (agents and tools that ran).
    """
    try:
        session = getattr(tool_context, "session", None)
        return await directory.run_agent(agent, message, session_key=getattr(session, "id", "builder"))
    except directory.DirectoryError as exc:
        return {"status": "error", "error": str(exc)}


async def delete_agent(agent: str, confirm: bool = False) -> dict:
    """Delete a generated project or one of its sub-agents: removes its code, detaches it from its parent
    agent and drops it from the Studio. Builder agents cannot be deleted. Irreversible: only call with
    confirm=true after the user explicitly confirmed this exact agent in this conversation.

    Args:
        agent: The agent id ('<project>' for a whole project, '<project>/<agent>' for a sub-agent).
        confirm: Must be true; without it nothing is deleted and you must ask the user to confirm.

    Returns:
        dict with status and what was deleted.
    """
    if not confirm:
        entry = directory.resolve(agent)
        what = entry["id"] if entry else agent
        return {"status": "confirmation_required", "message": f"Ask the user to confirm deleting '{what}' (its code is removed permanently)."}
    try:
        return await directory.delete_agent(agent)
    except directory.DirectoryError as exc:
        return {"status": "error", "error": str(exc)}
