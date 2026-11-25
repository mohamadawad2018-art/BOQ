# Security Specification — BOQ Ownership, Passcode Gate, Access Keys & Device Blocking

## 1. Data Invariants
1. Global default-deny (`match /{document=**} { allow read, write: if false; }`) blocks all undeclared paths.
2. Only `/app_config/access_control` is readable via single-doc `get`; `list` on `/app_config` is strictly denied.
3. Only the verified owner (`request.auth.token.email.lower() == 'mohamad.awad.2018@gmail.com'` AND `request.auth.token.email_verified == true`) can create or update `/app_config/access_control`, enforcing exact key allowlists, strict types, string length caps, `updatedBy == request.auth.uid`, and `updatedAt == request.time`.
4. `/owner_access_keys/{keyId}` isolates all user labels exclusively to `isOwnerAdmin()`, and atomically enforces matching `/access_passes/{passLookupId}` creation/deletion via `existsAfter()`.
5. `/access_passes/{passLookupId}` stores zero PII and zero plaintext passwords, forbids `list`, validates strict 32-hex lookup IDs, and restricts writes/deletes to `isOwnerAdmin()`.
6. `/devices/{deviceId}` enforces strict `^dev_[a-f0-9]{16}$` IDs, restricts `list` and `delete` strictly to `isOwnerAdmin()`, locks `isBlocked` and `customLabel` exclusively to `isOwnerAdmin()`, and enforces terminal-state locking: once `existing().isBlocked == true`, a device can NEVER self-update or unblock itself.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated write to `/app_config/access_control` trying to disable `passcodeEnabled` or alter `ownerSignature`.
2. Non-owner authenticated Google user attempting to block/unblock devices or create `/access_passes/{id}`.
3. Owner email spoof where `email_verified` is `false`.
4. Shadow/ghost field injection (`isAdmin: true`) into `/app_config/access_control`, `/owner_access_keys/{id}`, `/access_passes/{id}`, or `/devices/{id}`.
5. Blocked device attempting to flip its own `isBlocked` from `true` back to `false`.
6. Blocked device attempting to send a heartbeat update while `existing().isBlocked == true`.
7. Blocked device attempting to delete `/devices/{deviceId}` to erase its block status.
8. Non-owner attempting to `list` all connected devices in `/devices` or scrape `/access_passes`.
9. Device attempting to set `customLabel` or inject oversized `deviceName` (> 64 chars) or invalid `platform` enum.
10. Device creating a forged/poisoned ID (`/devices/admin` or 1KB ID string) instead of `^dev_[a-f0-9]{16}$`.
11. Backdated or client-forged `createdAt`/`lastSeenAt` timestamp not equal to `request.time`, or mutating immutable `createdAt`.
12. Deleting `/app_config/access_control` even as owner.
