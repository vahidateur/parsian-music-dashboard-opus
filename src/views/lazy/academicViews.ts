/**
 * Academic-workspace view group (M11/I6 route splitting).
 *
 * One lazy chunk for the academic surfaces so navigation inside the academic
 * day — the visits that actually chain together — pays one fetch, while the
 * entry chunk never contains any of them. Re-exports only; the views
 * themselves are untouched.
 *
 * `TeacherDashboard` rides with this group: `dashboard` is the landing view,
 * so it lives in the entry chunk, and the teacher's rendition of it therefore
 * has to arrive lazily. The teachers who open the desk are the same people who
 * open these six surfaces, so the fetch is not a new cost — it is the one they
 * were going to pay anyway.
 */
export { TeacherDashboard } from "../teacher/TeacherDashboard";
export { StudentsView } from "../Students";
export { TeachersView } from "../Teachers";
export { ClassesView } from "../Classes";
export { SchedulingView } from "../Scheduling";
export { AttendanceView } from "../Attendance";
export { CompensationView } from "../Compensation";
