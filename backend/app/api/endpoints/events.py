from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse
from app.services.sse_manager import sse_manager
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/stream")
async def stream_events(request: Request, user_id: str = "global"):
    """
    Server-Sent Events endpoint for real-time FinMA updates.
    Frontend subscribes via EventSource.
    """
    async def event_generator():
        # Subscribe to the manager and get a queue
        queue = await sse_manager.subscribe(user_id)
        
        try:
            while True:
                # Check for disconnection
                if await request.is_disconnected():
                    logger.info(f"🔌 SSE Client disconnected for user: {user_id}")
                    break
                
                # Fetch next message from queue (if any)
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield {
                        "event": "message",
                        "data": message
                    }
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat (optional)
                    # yield { "event": "ping", "data": "" }
                    continue

        finally:
            # Cleanup on disconnect
            await sse_manager.unsubscribe(queue, user_id)

    return EventSourceResponse(event_generator())
