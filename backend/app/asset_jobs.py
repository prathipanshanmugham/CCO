import os


def asset_pipeline_ready() -> bool:
    return bool(os.environ.get("FAL_KEY"))


def build_asset_job(design_id: str, concept_url: str, customer_id: str, job_id: str, created_at: str) -> dict:
    return {"id": job_id, "design_id": design_id, "customer_id": customer_id, "approved_concept_url": concept_url, "status": "queued", "preview_glb_private_key": None, "ar_usdz_private_key": None, "manufacturing_asset_private_key": None, "created_at": created_at}