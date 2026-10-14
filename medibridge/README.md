# MediBridge AI – base API

Prescription photo → structured, safety-checked care plan (Gemini).

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill real keys
pytest -q
uvicorn app.main:app --reload
```

```bash
curl -X POST localhost:8000/v1/care-plan \
  -H "X-API-Key: <client key>" \
  -F "file=@prescription.jpg" \
  -F 'context={"age":68,"preferred_language":"Hindi","allergies":[],"current_medicines":["Metformin"]}'
```

## Layout
| File | Role |
|---|---|
| `config.py` | env-only secrets, prod guards |
| `schemas.py` | input + LLM + response contracts |
| `prompts.py` | versioned prompt, injection defence |
| `security.py` | API key, rate limit, image hardening |
| `safety.py` | deterministic rules on LLM output |
| `service.py` | Gemini call (typed, timeout, fail-closed) |
| `main.py` | routes, CORS, headers, error handling |

## Before real patients (not in base code)
Consent + privacy policy (DPDP Act 2023 for India), encryption at rest, Redis rate limit,
auth via real identity provider, audit log w/o PHI, pharmacist review queue before caregiver
alerts, clinical validation of safety rules, drug-interaction DB (e.g. RxNorm / CDSCO data).
