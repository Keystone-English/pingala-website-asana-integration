# Project: Pingala Community Engagement Bridge (Squarespace <-> Asana)

## Role & Context
Integration for Pingala (community energy organization) connecting a Squarespace Member Area and an internal Asana project using Firebase as secure middleware.

## System Architecture
1. **Frontend (Squarespace):** Custom HTML/JS injected via a Code Block (`squarespace-injection.html`). Reads `SiteUserInfo` cookie for identity, fetches Asana tasks from Firestore, and posts comments to a Firebase Cloud Function.
2. **Middleware (Firebase):**
   - **Firestore:** Stores mirrored Asana tasks (synced via Asana webhooks).
   - **Cloud Functions (Node.js):** Acts as the API bridge (`postCommunityComment` and `syncAsanaTasks`).
3. **Backend (Asana):** Source of truth for projects and tasks.
