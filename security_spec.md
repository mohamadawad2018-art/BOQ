# Security Specification — BOQ Ownership, Passcode Gate & Per-User Access Control

## 1. Data Invariants
1. Global default-deny (`match /{document=**} { allow read, write: if false; }`) blocks all undeclared paths.
2. Only `/app_config/access_control` is readable via single-doc `get`; `list` on `/app_config` is strictly denied.
3. Only the verified owner (`request.auth.token.email.lower() == 'mohamad.awad.2018@gmail.com'` AND `request.auth.token.email_verified == true`) can create or update `/app_config/access_control`, enforcing exact key allowlists, strict types, string length caps (`pauseMessage <= 300`, `ownerSignature <= 120`, `passcodeSalt <= 64`, `passcodeHash <= 128`), `passcodeVersion` integer range, `updatedBy == request.auth.uid`, and `updatedAt == request.time`.
4. `/owner_access_keys/{keyId}` isolates all user labels/names exclusively to the verified owner (`isOwnerAdmin()`), and `list` further enforces `resource.data.createdBy == request.auth.uid`. Creation and deletion atomically enforce matching `/access_passes/{passLookupId}` existence via `existsAfter()`.
5. `/access_passes/{passLookupId}` stores zero PII and zero plaintext passwords (only PBKDF2-SHA256 `verifySalt`/`verifyHash`, `active`, `expiresAt`, `version`), forbids `list` completely, validates strict 32-hex lookup IDs on `get`, and restricts all writes/deletes strictly to `isOwnerAdmin()`.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated write to `/app_config/access_control` trying to disable `passcodeEnabled: false` or overwrite `ownerSignature`.
2. Non-owner authenticated Google user attempting to update `/app_config/access_control` or create an `/access_passes/{id}` entry.
3. Owner email spoof where `request.auth.token.email` matches owner but `email_verified` is `false`.
4. Shadow/ghost field injection (`isAdmin: true`) into `/app_config/access_control`, `/owner_access_keys/{id}`, or `/access_passes/{id}`.
5. Oversized string DoS payload (`ownerSignature` > 120 chars, `pauseMessage` > 300 chars, or `label` > 80 chars).
6. Collection scraping via `list` query on `/access_passes` or `/app_config`.
7. Non-owner `get` or `list` attempt on `/owner_access_keys` trying to read names of authorized users (PII isolation breach).
8. Document ID poisoning (`/access_passes/../../admin` or non-32-hex ID string).
9. Orphaned write creating `/owner_access_keys/{id}` without atomically creating `/access_passes/{passLookupId}` in the same batch (`existsAfter` check).
10. Immutability bypass attempting to alter `createdBy`, `createdAt`, or `passLookupId` on an existing `/owner_access_keys/{id}`.
11. Backdated or forged client `updatedAt` / `createdAt` timestamp not equal to `request.time`.
12. Deleting `/app_config/access_control` even as owner.
