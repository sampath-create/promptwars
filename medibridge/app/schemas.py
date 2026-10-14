"""Strict input + output contracts. Bounded lengths = bounded abuse / cost / UI breakage."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Short = Field(max_length=200)
Long = Field(max_length=1500)


# ---------- INPUT ----------
class PatientContext(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    age: int | None = Field(default=None, ge=0, le=120)
    preferred_language: str = Field(default="English", max_length=30, pattern=r"^[A-Za-z \-]+$")
    conditions: list[str] = Field(default_factory=list, max_length=20)
    allergies: list[str] = Field(default_factory=list, max_length=20)
    current_medicines: list[str] = Field(default_factory=list, max_length=30)
    pregnant_or_breastfeeding: bool = False
    patient_is_child: bool = False


# ---------- LLM OUTPUT (also used as Gemini response_schema) ----------
class Medication(BaseModel):
    medicine_name: str = Short
    strength: str | None = Short
    form: Literal["tablet", "capsule", "syrup", "injection", "inhaler", "other", "unknown"]
    dose: str = Short
    frequency: str = Short
    timing: str = Short
    duration: str | None = Short
    food_instruction: Literal[
        "before_food", "after_food", "with_food", "empty_stomach", "no_restriction", "unclear"
    ]
    purpose_if_stated: str | None = Short
    plain_language_purpose: str = Long
    important_warnings: list[str] = Field(max_length=10)
    source_text_from_image: str = Long


class ScheduleSlot(BaseModel):
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    medicines: list[str] = Field(max_length=20)
    instruction: str = Long
    reminder_message: str = Long


class SafetyFlag(BaseModel):
    severity: Literal["low", "medium", "high", "emergency"]
    issue: str = Long
    recommended_action: str = Long


class CarePlan(BaseModel):
    extraction_confidence: Literal["high", "medium", "low"]
    unreadable_or_missing_fields: list[str] = Field(max_length=30)
    patient_friendly_summary: str = Field(max_length=3000)
    medications: list[Medication] = Field(max_length=30)
    daily_schedule: list[ScheduleSlot] = Field(max_length=30)
    missed_dose_guidance: str = Long
    potential_safety_flags: list[SafetyFlag] = Field(max_length=20)
    caregiver_alert_needed: bool
    caregiver_alert_message: str = Long
    follow_up_questions_for_patient: list[str] = Field(max_length=10)
    medical_disclaimer: str = Long


# ---------- API RESPONSE (server adds safety envelope) ----------
class CarePlanResponse(BaseModel):
    care_plan: CarePlan
    requires_human_review: bool
    review_reasons: list[str]
    request_id: str
