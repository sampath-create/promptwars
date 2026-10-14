import io

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def img():
    b = io.BytesIO()
    Image.new("RGB", (20, 20)).save(b, "PNG")
    return b.getvalue()


def test_health_open():
    assert client.get("/health").status_code == 200


def test_no_api_key_401():
    r = client.post("/v1/care-plan", files={"file": ("a.png", img(), "image/png")})
    assert r.status_code == 401


def test_wrong_api_key_401():
    r = client.post("/v1/care-plan", headers={"X-API-Key": "nope"},
                    files={"file": ("a.png", img(), "image/png")})
    assert r.status_code == 401


def test_bad_context_422():
    r = client.post("/v1/care-plan", headers={"X-API-Key": "test-client-key"},
                    files={"file": ("a.png", img(), "image/png")}, data={"context": "{bad"})
    assert r.status_code == 422


def test_security_headers_present():
    h = client.get("/health").headers
    assert h["x-content-type-options"] == "nosniff" and h["cache-control"] == "no-store"


def test_frontend_served():
    r = client.get("/")
    assert r.status_code == 200
    assert "MediBridge" in r.text

