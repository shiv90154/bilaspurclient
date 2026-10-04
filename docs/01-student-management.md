# 1. Student Management

**Phase:** 1 · **Depends on:** [06-role-based-access](06-role-based-access.md), [09-security](09-security.md)

## Requirement
Student registration, profile, contact details, academic details, course/batch, student status, documents, search/filter, student-wise records aur basic reports.

## Scope V1
- Admin student register karta hai (ya student self-register + admin approve).
- Profile: naam, photo, phone, email, address, guardian contact.
- Academic: previous school/class, marks, target exam.
- Course/batch assignment (ek student ke multiple batches ho sakte hain).
- Status: `enquiry → active → inactive → completed → dropped`.
- Documents upload (ID proof, marksheet, photo).
- Search aur filter: naam, phone, batch, course, status.
- Student-wise record: attendance, test results, doubts, fees (agar baad mein) ek jagah.
- Basic reports + CSV/Excel export.

## Database tables
- `students` (id, user_id, name, phone, email, dob, gender, address, guardian_name, guardian_phone, photo_url, status, created_at)
- `academic_details` (student_id, prev_school, prev_class, prev_marks, target_exam)
- `courses` (id, name, description, active)
- `batches` (id, course_id, name, start_date, end_date, faculty_id, active)
- `student_batches` (student_id, batch_id, joined_at, status)
- `student_documents` (id, student_id, type, file_url, uploaded_at)
- `enquiries` (id, name, phone, course_interest, status, follow_up_date, notes)

## API endpoints
- `POST /students`, `GET /students?search=&batch=&status=&page=`, `GET/PATCH/DELETE /students/:id`
- `POST /students/:id/documents`, `GET /students/:id/documents`
- `POST /students/:id/batches`, `DELETE /students/:id/batches/:batchId`
- `GET /students/export?format=csv`
- `CRUD /courses`, `CRUD /batches`
- `CRUD /enquiries`, `PATCH /enquiries/:id/convert` (enquiry → student)

## Screens
- **Admin web:** student list (search/filter), add/edit form, student detail (tabs: profile, academic, documents, batches, results), courses/batches pages, enquiries list.
- **Android app:** login, own profile (view/edit limited fields), batch info.
- **Student web:** same as app, basic.

## Kaise banana hai (steps)
1. DB migrations: tables upar ke hisaab se.
2. NestJS modules: `students`, `courses`, `batches`, `enquiries`, `documents`.
3. File upload (multer) → storage service (local VPS / S3-compatible), docs ke liye signed URL.
4. Pagination + search (Postgres `ILIKE` ya full-text).
5. Admin web: list + form (React Hook Form + Zod), table with filters.
6. Flutter: profile screen + API client.
7. CSV export endpoint.
8. Tests: CRUD, filter, permission (faculty sirf apne batch ke students dekhe).

## Progress
- [x] DB migrations (all tables are in `backend/prisma/schema.prisma`)
- [x] Students CRUD API (compiled; not yet run against DB)
- [x] Courses & batches API (compiled; not yet run against DB)
- [x] Student–batch assignment (compiled; not yet run against DB)
- [ ] Documents upload/view
- [x] Enquiries API + convert to student (compiled; not yet run against DB)
- [x] Search / filter / pagination
- [ ] CSV export
- [ ] Admin web: list + add/edit
- [ ] Admin web: student detail page
- [ ] Android: profile screen
- [ ] Student web: profile page
- [ ] Tests

## Notes
- Phone number unique rakho (login ke liye bhi use ho sakta hai).
- Delete = soft delete (record kabhi hard delete nahi).
