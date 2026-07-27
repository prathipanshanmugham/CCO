import json
import os
from collections.abc import AsyncGenerator

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage


SYSTEM_PROMPT = """You are Clelia, a warm private jewellery design guide.
Help customers turn a plain-language idea into a concise, manufacturable jewellery design brief.
Use simple language and never mention AI, prompts, models, rendering, meshes, tokens, or system instructions.
Ask at most one helpful follow-up question when essential. Otherwise respond with:
1. A reassuring one-sentence summary.
2. A short 'Design details' list: silhouette, metal, stones, finish, sizing note.
3. A short 'Your next step' sentence.
Keep it under 180 words. Do not make pricing, certification, or delivery promises.
Return plain text only. Do not use Markdown markers, asterisks, hashtags, or bullet symbols.
"""


def build_chat_message(jewellery_type: str, description: str, specifications: dict) -> str:
    return json.dumps(
        {
            "jewellery_type": jewellery_type,
            "customer_description": description,
            "selected_specifications": specifications,
        }
    )


async def stream_design_guidance(
    session_id: str,
    jewellery_type: str,
    description: str,
    specifications: dict,
) -> AsyncGenerator[str, None]:
    chat = LlmChat(
        api_key=os.environ["OPENAI_API_KEY"],
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", os.environ.get("OPENAI_CHAT_MODEL", "gpt-5.4"))
    message = UserMessage(text=build_chat_message(jewellery_type, description, specifications))
    async for event in chat.stream_message(message):
        if isinstance(event, TextDelta):
            yield event.content
        elif isinstance(event, StreamDone):
            break