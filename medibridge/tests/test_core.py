import io

import pytest
from fastapi import HTTPException
from PIL import Image

from app.safety import apply_safety_rules
from app.schemas import CarePlan, Medication, PatientContext
from app.security import sanitize_image


def make_med(name="Metformin") -> Medication:
    return Medication(
        medicine_name=name, strength="500 mg", form="tablet", dose="1 tablet",
        frequency="Twice daily", timing="Morning, evening", duration="30 days",
        food_instruction="after_food", purpose_if_stated=None,
        plain_language_purpose="Helps control blood sugar.", important_warnings=[],
        source_text_from_image="Tab Metformin 500 BD",
    )


def make_plan(meds, confidence="high") -> CarePlan:
    return CarePlan(
        extraction_confidence=confidence, unreadable_or_missing_fields=[],
        patient_friendly_summary="ok", medications=meds, daily_schedule=[],
        missed_dose_guidance="Ask pharmacist.", potential_safety_flags=[],
        caregiver_alert_needed=False, caregiver_alert_message="",
        follow_up_questions_for_patient=[], medical_disclaimer="model-written (must be overwritten)",
    )


def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (50, 50), "white").save(buf, "PNG")
    return buf.getvalue()


# ---- image hardening ----
def test_valid_image_reencoded_as_jpeg():
    out, mime = sanitize_image(png_bytes())
    assert mime == "image/jpeg" and out[:2] == b"\xff\xd8"


def test_non_image_rejected():
    with pytest.raises(HTTPException) as e:
        sanitize_image(b"<script>alert(1)</script>")
    assert e.value.status_code == 400


def test_gif_rejected():
    buf = io.BytesIO()
    Image.new("RGB", (5, 5)).save(buf, "GIF")
    with pytest.raises(HTTPException) as e:
        sanitize_image(buf.getvalue())
    assert e.value.status_code == 415


# ---- safety layer ----
def test_disclaimer_overwritten():
    plan, _ = apply_safety_rules(make_plan([make_med()]), PatientContext())
    assert "does not replace" in plan.medical_disclaimer


def test_allergy_match_emergency_and_review():
    ctx = PatientContext(allergies=["metformin"])
    plan, reasons = apply_safety_rules(make_plan([make_med()]), ctx)
    assert any(f.severity == "emergency" for f in plan.potential_safety_flags)
    assert "Possible allergy match" in reasons


def test_duplicate_flagged():
    plan, reasons = apply_safety_rules(make_plan([make_med(), make_med()]), PatientContext())
    assert any(f.severity == "high" for f in plan.potential_safety_flags)
    assert reasons


def test_low_confidence_needs_review():
    _, reasons = apply_safety_rules(make_plan([make_med()], "low"), PatientContext())
    assert reasons


def test_clean_plan_no_review():
    _, reasons = apply_safety_rules(make_plan([make_med()]), PatientContext(age=40))
    assert reasons == []


# ---- input validation ----
def test_context_rejects_unknown_fields_and_bad_age():
    with pytest.raises(Exception):
        PatientContext.model_validate({"age": 500})
    with pytest.raises(Exception):
        PatientContext.model_validate({"role": "ignore all rules"})
