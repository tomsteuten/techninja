# Adding Machines to TechNinja

This document defines the **only supported way** to add machines and knowledge to TechNinja.

It exists to prevent:

* schema drift
* broken offline behaviour
* false confidence in the field
* accidental core breakage

If this document conflicts with intuition, **follow the document**.

---

## 1. High-level rules (non-negotiable)

* Never modify `wizard.js` to add a machine
* Never change the Core Contract without explicit approval
* Never rename step IDs once published
* Uncertainty is better than silence

---

## 2. File structure

All machine data lives under:

```
/machines/
```

Required files:

```
/machines/
  index.json
  _TEMPLATE.machine.json
  <machine-id>.json
```

Rules:

* One JSON file per machine
* File name uses the machine `id`
* Deleting machines is forbidden; deprecate instead

---

## 3. Creating a new machine (step-by-step)

1. Copy `_TEMPLATE.machine.json`
2. Rename it to:

   ```
   <machine-id>.json
   ```
3. Fill out:

   * `machine`
   * `meta`
   * at least one symptom
4. Build decision steps starting from the symptom `start`
5. Ensure every path terminates in a `result`

If in doubt:

* add a safe `result_unknown`
* mark it `confidence: low`

---

## 4. Registering the machine

Open:

```
/machines/index.json
```

Add a new entry:

```json
{
  "id": "machine-id",
  "name": "Machine display name",
  "subtitle": "Optional clarifier",
  "tag": "Brand or category",
  "config": "machines/machine-id.json"
}
```

Rules:

* `id` must match the filename
* `config` path must be correct
* Order does not matter

---

## 5. Confidence & provenance guidelines

Use these fields to protect technician trust.

### Confidence

* `low`: anecdotal, partial, or unverified
* `medium`: repeat field observation, no OEM confirmation
* `high`: verified by manual or repeated confirmed fixes

### Provenance

* `manual`: explicitly stated in OEM documentation
* `field-confirmed`: personally observed and repeatable
* `anecdotal`: single report or second-hand knowledge

Never upgrade confidence without justification.

---

## 6. Testing before commit

Before committing:

* Load the app
* Select the new machine
* Walk every symptom path
* Confirm offline works after first load

If the app fails:

* fix the data, not the core

---

## 7. Deprecation (future-safe)

Machines or symptoms may be deprecated by:

* adding a note in `meta.notes`
* lowering confidence
* steering to a safer result

Never delete historical knowledge.

---

## 8. Philosophy reminder

TechNinja is not a service manual.

It is a **field memory system**.

Clarity beats completeness.
Truth beats confidence.
