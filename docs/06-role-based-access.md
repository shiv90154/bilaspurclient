# 6. Role-Based Access

**Phase:** 1 · **Depends on:** [09-security](09-security.md)

## Requirement
Admin, faculty aur students ke liye alag permissions.

## Roles
| Role | Kya kar sakta hai |
|---|---|
| **Admin** | Sab kuch: students, faculty, batches, content, reports, device reset, settings |
| **Faculty** | Apne batches/subjects ke students dekhna, material upload, questions/tests, doubts reply, classes schedule |
| **Student** | Apna profile, apne batch ka material/tests/classes, doubts submit |

(Future: `staff/counsellor` role sirf enquiries ke liye — design aise rakho ki role add ho sake.)

## Permission matrix (V1)
| Resource | Admin | Faculty | Student |
|---|---|---|---|
| Students (all) | CRUD | Read (apne batch) | Own read/limited edit |
| Courses / Batches | CRUD | Read | Read own |
| Faculty users | CRUD | — | — |
| Materials | CRUD | CRUD (apne subject) | Read (apne batch) |
| Questions / Tests | CRUD | CRUD (apne subject) | Attempt |
| Doubts | All | Assigned/apne batch | Own |
| Classes | CRUD | CRUD (apne) | Read/Join |
| Enquiries | CRUD | — | — |
| Reports / Dashboard | Full | Limited | — |
| Device reset | ✅ | ❌ | ❌ |

## Database tables
- `users` (id, phone, email, password_hash, role, status, last_login)
- `faculty` (id, user_id, name, subjects, bio)
- `faculty_subjects` / `faculty_batches` (mapping)
- `permissions` (optional, role → permission) — V1 mein code-level guards kaafi

## Kaise banana hai (steps)
1. `users` + `role` enum.
2. Auth: login (phone/email + password), JWT access + refresh token.
3. NestJS `RolesGuard` + `@Roles('admin','faculty')` decorator.
4. **Ownership checks** (faculty sirf apne batch/subject ke data par) service layer mein, sirf guard mein nahi.
5. Seed: pehla admin user.
6. Admin web: faculty management page, role-based sidebar (menu role se).
7. Flutter/Web: role se UI hide, par **asli enforcement backend par**.
8. Tests: har endpoint par har role ke liye 200/403.

## Progress
- [x] Users + roles tables
- [x] Login + JWT + refresh
- [x] RolesGuard + decorators
- [ ] Ownership checks (faculty scope)
- [x] Admin seed script
- [ ] Faculty CRUD (admin web)
- [x] Role-based menus (web)
- [ ] Role-based UI (Android)
- [ ] Permission test matrix (only a few cases covered by `smoke:auth` / `smoke-web` so far)

## Notes
- UI hide karna security nahi hai; backend guard zaroori.
