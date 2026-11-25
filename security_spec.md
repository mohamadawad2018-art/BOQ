# Security Specification — BOQ App Remote Access Control

## 1. Data Invariants
1. Only `/app_config/access_control` is readable via `get`; collection `list` queries are strictly denied.
2. Only the verified owner (`request.auth.token.email.lower() == 'mohamad.awad.2018@gmail.com'` AND `request.auth.token.email_verified == true`) can create or update `/app_config/access_control`.
3. Every write must pass `isValidAccessControl(incoming())`, enforcing exact key allowlist (`isActive`, `pauseMessage`, `updatedBy`, `updatedAt`), strict types, `pauseMessage.size() <= 300`, `updatedBy == request.auth.uid`, and server timestamp integrity (`updatedAt == request.time`).
4. No PII (emails, phone numbers, addresses) is ever stored in `/app_config/access_control`.
5. Deletion of `/app_config/access_control` is permanently forbidden.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated write to `/app_config/access_control`.
2. Authenticated non-owner user attempting to flip `isActive: false`.
3. Owner email spoof with `email_verified: false`.
4. Shadow/ghost field injection (`{ isActive: true, pauseMessage: "ok", updatedBy: uid, updatedAt: serverTimestamp, isAdmin: true }`).
5. Oversized `pauseMessage` (> 300 chars) DoS / Denial-of-Wallet payload.
6. Type poisoning (`isActive: "true"` string instead of boolean).
7. Identity spoofing (`updatedBy` set to another UID instead of `request.auth.uid`).
8. Backdated/client-forged `updatedAt` timestamp (not `request.time`).
9. Document ID poisoning (`/app_config/malicious_doc_id` or 1.5KB ID string).
10. Collection scraping via `list` query on `/app_config`.
11. Deleting `/app_config/access_control` even by owner.
12. Accessing any undeclared collection (caught by global default-deny `/{document=**}`).
