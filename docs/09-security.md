# 9. Security

**Phase:** 0 → 3 (har phase mein) · Content protection ke liye dekho [10-android-protection](10-android-protection.md)

## Requirement
Authentication, authorization, data protection aur SSL communication.

## Checklist by area

### Authentication
- Login: phone/email + password (bcrypt/argon2). OTP optional baad mein.
- JWT access (15 min) + refresh token (rotating, DB mein hashed).
- Login rate limiting + lockout after repeated failures.
- Password reset flow (OTP/email).
- Ek student = ek device (see [10](10-android-protection.md)).

### Authorization
- RolesGuard + ownership checks ([06](06-role-based-access.md)).
- Har endpoint par permission test.

### Data protection
- Passwords hash; sensitive fields (documents) private storage.
- Files par **signed URLs**, short expiry.
- Input validation (DTO + class-validator), SQL injection se bachne ke liye ORM/parameterized queries.
- XSS: output escape, CSP headers (web).
- File upload: type/size whitelist.
- Personal data (phone, address, documents) ka access log.
- Daily encrypted backups.

### Transport
- HTTPS everywhere (Let's Encrypt), HSTS.
- App mein certificate pinning (optional, Phase 3).
- CORS sirf apne domains.

### Infra
- Firewall (sirf 80/443/SSH), SSH key only, fail2ban.
- Secrets `.env` / secret manager, repo mein kabhi nahi.
- Dependency updates + `npm audit`.
- Rate limiting + helmet on API.

### Monitoring
- Audit/activity log ([07](07-admin-dashboard.md)).
- Error tracking (Sentry), uptime alerts.

## Kaise banana hai (steps)
1. Phase 0: hashing, JWT, helmet, rate limit, CORS, validation, HTTPS.
2. Phase 1: device binding, role guards, activity log.
3. Phase 2: signed URLs, upload validation, secure viewer.
4. Phase 3: pen-test checklist (OWASP Top 10), dependency audit, backup restore drill.

## Progress
- [x] Password hashing (argon2id)
- [x] JWT + refresh rotation (reuse detection, session checked on every request)
- [x] Login rate limit / lockout
- [ ] Password reset
- [x] Helmet / CORS / validation
- [ ] HTTPS + HSTS
- [ ] Signed URLs for files
- [ ] Upload validation
- [ ] Activity / audit log (service ready; only login and reset-device are logged so far)
- [ ] Firewall + SSH hardening
- [ ] Encrypted backups + restore test
- [ ] Sentry / alerts
- [ ] OWASP Top 10 review
- [ ] (Optional) cert pinning

## Notes
- Security ek baar ka kaam nahi; har phase ke end par review.
