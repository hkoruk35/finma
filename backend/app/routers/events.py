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
    """
    async def event_generator():
        # Subscribe to the manager and get a queue
        queue = await sse_manager.subscribe(user_id)
        
        try:
            while True:
                if await request.is_disconnected():
                    break
                
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield {
                        "event": "message",
                        "data": message
                    }
                except asyncio.TimeoutError:
                    continue

        finally:
            await sse_manager.unsubscribe(queue, user_id)

    return EventSourceResponse(event_generator())
