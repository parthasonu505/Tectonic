"""Backend entrypoint: the ADK API server plus the Command Center telemetry WebSocket.

Replaces ``adk api_server`` — same routes (/run, /run_sse, /apps/...) on the same port, with a
global TelemetryPlugin attached to every agent run and ``/ws/telemetry`` streaming its events.
The shared core modules (tectonic_runtime) stream their activity on the same socket.

    python server.py            # http://127.0.0.1:8000, ws://127.0.0.1:8000/ws/telemetry
"""

import asyncio
import os
from pathlib import Path

import uvicorn
from google.adk.cli.fast_api import get_fast_api_app
from google.adk.cli.utils._nested_agent_loader import NestedAgentLoader

from agent_builder.telemetry import hub
from agent_builder.telemetry import router as telemetry_router
from tectonic_runtime import bus as module_bus
from tectonic_runtime import get_runtime
from tectonic_runtime.simulation import is_running, run_office_simulation

PROJECT_ROOT = Path(__file__).resolve().parent
HOST = os.getenv("AGENT_BUILDER_HOST", "127.0.0.1")
PORT = int(os.getenv("AGENT_BUILDER_PORT", "8000"))

app = get_fast_api_app(
    agents_dir=str(PROJECT_ROOT),
    # Generated agents are addressed by dotted path (generated_agents.<project>.<project>). With
    # web=False ADK defaults to the flat AgentLoader, which rejects dots; the nested loader accepts them.
    agent_loader=NestedAgentLoader(str(PROJECT_ROOT)),
    web=False,
    host=HOST,
    port=PORT,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    extra_plugins=["agent_builder.telemetry.telemetry_plugin"],
)
app.include_router(telemetry_router)


def _forward_module_event(event: dict) -> None:
    payload = {k: v for k, v in event.items() if k not in ("type", "timestamp")}
    hub.emit(event["type"], **payload)


module_bus.subscribe(_forward_module_event)
runtime = get_runtime()  # registers every module (state "offline" until first use)
_background: set[asyncio.Task] = set()


@app.get("/modules")
async def list_modules() -> dict:
    return {"modules": runtime.describe(), "simulation_running": is_running()}


@app.post("/modules/simulate")
async def simulate_office() -> dict:
    if is_running():
        return {"status": "already_running"}
    task = asyncio.create_task(run_office_simulation(runtime, agent_events=hub.emit))
    _background.add(task)
    task.add_done_callback(_background.discard)
    return {"status": "started"}


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)
