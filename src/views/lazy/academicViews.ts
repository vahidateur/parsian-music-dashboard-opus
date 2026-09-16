/**
 * Academic-workspace view group (M11/I6 route splitting).
 *
 * One lazy chunk for the six academic surfaces so navigation inside the
 * academic day — the visits that actually chain together — pays one fetch,
 * while the entry chunk never contains any of them. Re-exports only; the
 * views themselves are untouched.
 */
export { StudentsView } from "../Students";
export { TeachersView } from "../Teachers";
export { ClassesView } from "../Classes";
export { SchedulingView } from "../Scheduling";
export { AttendanceView } from "../Attendance";
export { CompensationView } from "../Compensation";
