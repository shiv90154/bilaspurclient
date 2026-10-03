# 7. Admin Dashboard

**Phase:** v1 in Phase 1, v2 in Phase 3 · **Depends on:** sab modules ka data

## Requirement
Total/active students, enquiries, pending follow-ups, study-material count, question-bank count, live classes, active users, recent activities aur basic reports.

## Widgets
| Widget | Source | Phase |
|---|---|---|
| Total / active students | `students` | 1 |
| Enquiries (new / converted) | `enquiries` | 1 |
| Pending follow-ups (aaj ke / overdue) | `enquiries.follow_up_date` | 1 |
| Study-material count | `materials` | 2 |
| Question-bank count | `questions` | 2 |
| Live / upcoming classes | `live_classes` | 3 |
| Active users (aaj / 7 din) | `users.last_login` / sessions | 1 |
| Recent activities feed | `activity_log` | 1 |
| Pending doubts | `doubts` | 2 |

## Reports (basic)
- Student list (batch/course/status wise) – CSV
- Test result report (batch-wise)
- Attendance report (class-wise)
- Enquiry conversion report
- Material views report

## Database
- `activity_log` (id, actor_id, action, entity, entity_id, meta, created_at) — har important action par entry
- Counts ke liye existing tables; heavy hone par cached/materialized view

## API endpoints
- `GET /dashboard/summary`
- `GET /dashboard/activities?limit=`
- `GET /reports/students`, `/reports/tests/:id`, `/reports/attendance`, `/reports/enquiries` (`?format=csv`)

## Screens
- **Admin web:** dashboard home (cards + chart + recent activity), reports page.
- **Faculty web:** limited dashboard (apne batch ke numbers).

## Kaise banana hai (steps)
1. Activity log service (interceptor) — create/update/delete par log.
2. Summary endpoint (parallel count queries, short cache 30–60s).
3. Dashboard UI: stat cards, recent activity, small charts.
4. Reports endpoints + CSV streaming.
5. Faculty-scoped version of summary.
6. Widgets baaki modules ke saath jaise-jaise ban-te jayein add karo.

## Progress
- [x] Activity log service (`ActivityService`; table `activity_logs`)
- [ ] Summary API (students, enquiries, follow-ups)
- [ ] Active users metric
- [ ] Dashboard UI v1
- [ ] Recent activity feed
- [ ] Material / question counts
- [ ] Pending doubts widget
- [ ] Live classes widget
- [ ] Reports + CSV export
- [ ] Faculty-scoped dashboard
- [ ] Charts polish (v2)

## Notes
- UI design reference: EduManage artifact.
