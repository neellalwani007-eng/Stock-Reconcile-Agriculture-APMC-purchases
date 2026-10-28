---
name: Deployment portability
description: The user expects the reconciliation app to run from GitHub on Render.
---

Keep changes portable beyond Replit and avoid introducing Replit-only runtime dependencies.

**Why:** The user said they intend to push the code to GitHub and run it on Render.

**How to apply:** For app and database changes, identify any required environment setup or schema updates for Render and explain those steps clearly. This existing Render service is configured in the dashboard, so changing `render.yaml` alone does not update its commands.
