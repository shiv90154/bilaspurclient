# 4. Notes & Study Material

**Phase:** 2 · **Depends on:** [01-student-management](01-student-management.md), [10-android-protection](10-android-protection.md)

## Requirement
PDF/document upload, subject-wise aur chapter/topic-wise organization, batch-wise access, in-app viewing, download permission control, search/filter, material ki replacement/update.

## Scope V1
- Faculty/admin PDF/doc upload (title, subject, chapter/topic, batches).
- Batch-wise access: student sirf apne batch ka material dekhe.
- Organization: course → subject → chapter → material.
- **In-app viewer** only; **download permission** per material (default off).
- Search/filter: title, subject, chapter.
- Replace/update: nayi version upload, purani archive (version history).
- Android: **watermark + FLAG_SECURE**, encrypted cache.

## Database tables
- `materials` (id, title, description, subject_id, topic_id, file_key, file_type, size, allow_download, version, status, uploaded_by, updated_at)
- `material_versions` (material_id, version, file_key, uploaded_at)
- `material_batches` (material_id, batch_id)
- `material_views` (material_id, student_id, viewed_at) — analytics

## API endpoints
- `POST /materials` (multipart), `GET /materials?subject=&topic=&search=`, `PATCH /materials/:id`, `DELETE /materials/:id`
- `POST /materials/:id/replace`
- `GET /materials/:id/view-url` → **short-lived signed URL** (2–5 min)
- `GET /materials/:id/download-url` → sirf `allow_download = true` par

## Screens
- **Admin web:** upload form, material list with filters, batch assignment, replace, download toggle.
- **Android:** subject → chapter → material list, in-app PDF viewer with watermark.
- **Student web:** list ya skip (protected). Download off hone par web par bhi view na dikhao (screenshot rok nahi sakte).

## Kaise banana hai (steps)
1. Storage service (local VPS ya S3-compatible), private bucket, signed URLs.
2. Upload API: file type/size validation, virus scan optional.
3. Material CRUD + batch mapping + version table.
4. Access check: student ka batch material ke batch se match kare.
5. Signed URL endpoint (expiry chhota), views log.
6. Flutter PDF viewer (`pdfx` / `syncfusion_flutter_pdfviewer`), in-memory ya encrypted file, **koi share/open-with nahi**.
7. Watermark overlay (student naam + phone) har page par.
8. Search (Postgres full-text).
9. Tests: unauthorized batch access, expired URL, download flag.

## Progress
- [ ] Storage + signed URLs
- [ ] Upload API + validation
- [ ] Material CRUD + batch mapping
- [ ] Versioning / replace
- [ ] Download permission flag
- [ ] Search / filter
- [ ] Admin web: upload + list
- [ ] Android: browse materials
- [ ] Android: secure PDF viewer
- [ ] Android: watermark overlay
- [ ] View analytics
- [ ] Tests

## Notes
- File URL kabhi permanent public mat rakho.
- Document formats: V1 mein PDF; doc/ppt ko server par PDF mein convert karna baad mein.
