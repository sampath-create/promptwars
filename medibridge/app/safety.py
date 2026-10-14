"""Deterministic safety layer. LLM output is UNTRUSTED. Rules here do not depend on the model."""
import re

from .prompts import DISCLAIMER
from .schemas import CarePlan, PatientContext, SafetyFlag

_NORM = re.compile(r"[^a-z0-9 ]")


def _norm(s: str) -> str:
    return _NORM.sub("", s.lower()).strip()


def _flag(plan: CarePlan, severity: str, issue: str, action: str) -> None:
    plan.potential_safety_flags.append(
        SafetyFlag(severity=severity, issue=issue, recommended_action=action)  # type: ignore[arg-type]
    )


def apply_safety_rules(plan: CarePlan, ctx: PatientContext) -> tuple[CarePlan, list[str]]:
    """Returns (hardened plan, reasons a human must review before anything is auto-sent)."""
    reasons: list[str] = []
    names = [_norm(m.medicine_name) for m in plan.medications]

    # 1. Never trust model-written disclaimer
    plan.medical_disclaimer = DISCLAIMER

    # 2. Low confidence / unreadable -> review
    if plan.extraction_confidence != "high" or plan.unreadable_or_missing_fields:
        reasons.append("Low/medium extraction confidence or unreadable fields")

    # 3. Nothing extracted
    if not plan.medications:
        reasons.append("No medicines extracted")
        _flag(plan, "medium", "No medicines could be read from the image.",
              "Upload a clearer photo or ask a pharmacist to confirm.")

    # 4. Duplicate medicine inside one prescription
    dupes = {n for n in names if n and names.count(n) > 1}
    if dupes:
        reasons.append("Duplicate medicine in prescription")
        _flag(plan, "high", f"Same medicine listed more than once: {', '.join(sorted(dupes))}.",
              "Confirm with prescriber or pharmacist before taking.")

    # 5. Allergy match (substring both ways; crude but fail-safe)
    for allergy in filter(None, map(_norm, ctx.allergies)):
        for med in names:
            if med and (allergy in med or med in allergy):
                reasons.append("Possible allergy match")
                _flag(plan, "emergency", f"Listed allergy '{allergy}' may match '{med}'.",
                      "Do NOT take. Contact doctor or pharmacist immediately.")

    # 6. Overlap with already-taken medicines
    current = set(filter(None, map(_norm, ctx.current_medicines)))
    for med in names:
        if med in current:
            _flag(plan, "low", f"'{med}' is already in current medicines.",
                  "Confirm whether this is a continuation or a dose change.")

    # 7. Vulnerable groups -> always human review
    if ctx.pregnant_or_breastfeeding:
        reasons.append("Pregnant or breastfeeding patient")
    if ctx.patient_is_child or (ctx.age is not None and ctx.age < 12):
        reasons.append("Paediatric patient")
    if ctx.age is not None and ctx.age >= 75:
        reasons.append("Elderly patient (polypharmacy risk)")

    # 8. High/emergency flag -> review; caregiver alert is NEVER auto-sent
    if any(f.severity in ("high", "emergency") for f in plan.potential_safety_flags):
        reasons.append("High-severity safety flag")
    if plan.caregiver_alert_needed:
        reasons.append("Caregiver alert proposed (requires approval)")

    return plan, sorted(set(reasons))
