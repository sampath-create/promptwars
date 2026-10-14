"""MediBridge AI - prescription -> safe care plan API."""
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .config import Settings, get_settings
from .safety import apply_safety_rules
from .schemas import CarePlanResponse, PatientContext
from .security import enforce_rate_limit, read_limited, require_api_key, sanitize_image
from .service import CarePlanService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("medibridge")

MAX_CONTEXT_CHARS = 4000


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.service = CarePlanService(get_settings())
    yield


settings = get_settings()
app = FastAPI(
    title="MediBridge AI",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_prod else "/docs",   # hide API docs in prod
    redoc_url=None,
    openapi_url=None if settings.is_prod else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,          # explicit list, never "*"
    allow_methods=["POST", "GET"],
    allow_headers=["X-API-Key", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Cache-Control"] = "no-store"   # medical data: never cache
    resp.headers["Referrer-Policy"] = "no-referrer"
    return resp


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled %s", type(exc).__name__)  # type only, no stack/PHI to client
    return JSONResponse({"detail": "Internal error"}, status_code=500)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/care-plan", response_model=CarePlanResponse)
async def create_care_plan(
    request: Request,
    file: UploadFile = File(..., description="Prescription / medicine photo"),
    context: str = Form("{}", description="PatientContext as JSON"),
    api_key: str = Depends(require_api_key),
    cfg: Settings = Depends(get_settings),
) -> CarePlanResponse:
    enforce_rate_limit(request, api_key)
    request_id = uuid.uuid4().hex

    if len(context) > MAX_CONTEXT_CHARS:
        raise HTTPException(413, "Context too large")
    try:
        ctx = PatientContext.model_validate_json(context)
    except ValidationError:
        raise HTTPException(422, "Invalid patient context")

    raw = await read_limited(file, cfg.max_upload_mb * 1024 * 1024)
    image, mime = sanitize_image(raw, cfg)

    plan = await request.app.state.service.generate(image, mime, ctx)
    plan, reasons = apply_safety_rules(plan, ctx)

    log.info("care_plan ok id=%s meds=%d review=%s", request_id, len(plan.medications), bool(reasons))
    return CarePlanResponse(
        care_plan=plan,
        requires_human_review=bool(reasons),
        review_reasons=reasons,
        request_id=request_id,
    )


# Serve frontend UI at root
from pathlib import Path
from fastapi.staticfiles import StaticFiles

_frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if _frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")

