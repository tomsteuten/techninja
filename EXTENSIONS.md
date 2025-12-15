# TechNinja Extensions (Additive, Safe-to-Iterate)

This document describes **optional extensions** that are safe to add without breaking the frozen core defined in `CORE_CONTRACT.md`.

Nothing here is required by the current UI/logic.

---

## 1) Result Confidence and Uncertainty

Machine JSON `result` objects may include optional metadata.

### Recommended schema (optional)

```json
{
  "result": {
    "title": "…",
    "likelyCause": "…",
    "fieldFix": ["…"],
    "official": ["…"],
    "warnings": ["…"],

    "confidence": {
      "level": "high|medium|low|unknown",
      "score": 0,
      "basis": "confirmed|manual|anecdotal"
    },
    "provenance": {
      "sources": ["manual", "tech", "history-tab", "training"],
      "lastConfirmed": "YYYY-MM-DD",
      "addedBy": "initials/name",
      "notes": "Short note"
    }
  }
}
```

### Interpretation rules
- `level` is human-first and should be used even if `score` is absent.
- `score` is optional; if used, treat as a *rough* confidence indicator (0–100).
- `basis` communicates why you believe it: confirmed in field, derived from manual, anecdotal, etc.
- `sources` can be multiple.
- `lastConfirmed` should be updated when a fix is re-validated.

**Design intent:** show uncertainty explicitly to preserve technician trust.

---

## 2) Minimal Persistence (Local Only)

TechNinja stores the last wizard state to allow fast resume.

### Storage key
- `localStorage["techninja.session.v1"]`

### Stored shape
```json
{
  "v": 1,
  "ts": 0,
  "machineId": "…",
  "symptomId": "…",
  "stepId": "…",
  "history": ["stepId1","stepId2"]
}
```

Rules:
- If schema ever changes, bump `v` and keep backward compatibility where possible.
- Persistence must remain **local-only** unless explicitly approved.

---

## 3) Multi-machine Registry

Machines are listed in `machines/index.json`.

### Schema
```json
{
  "schemaVersion": "1.0",
  "machines": [
    { "id": "…", "name": "…", "subtitle": "…", "tag": "…", "config": "machines/…json" }
  ]
}
```

The wizard will fallback to a hardcoded list if this file is missing or invalid.

---

## 4) Offline caching expectations

- `machines/index.json` is part of the app shell cache.
- Machine configs are precached on install (best-effort) and also cached at runtime when fetched.
