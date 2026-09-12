---
name: Mockup preview bootstrap
description: The mockup artifact helper may fail to register an artifact even though its bootstrap script can create a working sandbox.
---

When the artifact helper cannot create or register a mockup sandbox, the bootstrap script can still create `artifacts/mockup-sandbox`; run its Vite server directly with `PORT` and `BASE_PATH` and use the canvas iframe preview.

**Why:** The visual preview was needed immediately, and the helper failed before creating the artifact metadata while the generated sandbox itself served correctly.

**How to apply:** Prefer the normal artifact flow first. If registration fails, preserve the generated sandbox, start its preview server directly, and verify the iframe with a screenshot before continuing UI work.