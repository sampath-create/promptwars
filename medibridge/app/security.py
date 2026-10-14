"""Auth, rate limiting, upload hardening. No PHI is logged anywhere in here."""
import hmac
import io
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import Settings, get_settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 40_000_000  # decompression-bomb guard
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


# ---------- API key auth (constant-time compare) ----------
def require_api_key(x_api_key: str = Header(default="")) -> str:
    settings = get_settings()
    for valid in settings.api_key_list:
        if hmac.compare_digest(x_api_key.encode(), valid.encode()):
            return valid
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing API key")


# ---------- Sliding-window rate limit ----------
# In-memory = single instance only. Production: Redis / API gateway.
class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, identity: str, limit: int, window: int = 60) -> None:
        now = time.monotonic()
        q = self._hits[identity]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests")
        q.append(now)


limiter = RateLimiter()


def enforce_rate_limit(request: Request, api_key: str) -> None:
    ident = f"{api_key[:8]}:{request.client.host if request.client else 'unknown'}"
    limiter.check(ident, get_settings().rate_limit_per_minute)


# ---------- Upload validation ----------
async def read_limited(file: UploadFile, max_bytes: int) -> bytes:
    """Read in chunks; abort as soon as size cap crossed (don't buffer attacker payload)."""
    buf = bytearray()
    while chunk := await file.read(64 * 1024):
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image too large")
    if not buf:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    return bytes(buf)


def sanitize_image(raw: bytes, settings: Settings | None = None) -> tuple[bytes, str]:
    """Verify real image by content (not filename/Content-Type), strip EXIF/GPS,
    fix rotation, downscale, re-encode as JPEG. Returns (bytes, mime)."""
    settings = settings or get_settings()
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use JPEG, PNG or WEBP")
            probe.verify()
        with Image.open(io.BytesIO(raw)) as img:  # verify() invalidates; reopen
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((settings.max_image_side_px, settings.max_image_side_px))
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=90)  # fresh encode = no metadata carried
            return out.getvalue(), "image/jpeg"
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or corrupt image")
