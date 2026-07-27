from datetime import datetime, timezone
from uuid import uuid4


CONCEPT_IMAGES = [
    "https://images.unsplash.com/photo-1514612497953-05d1e5e171fa?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1613945407943-59cd755fd69e?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=85",
]


def clean_document(document: dict | None) -> dict | None:
    if not document:
        return None
    document.pop("_id", None)
    document.pop("password_hash", None)
    document.pop("totp_secret", None)
    return document


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_concepts(design_id: str) -> list[dict]:
    labels = ["The Heirloom", "The Modern Muse", "The Signature"]
    return [
        {"id": f"{design_id}-{index}", "name": labels[index], "image_url": image, "status": "ready"}
        for index, image in enumerate(CONCEPT_IMAGES)
    ]


def new_id() -> str:
    return str(uuid4())