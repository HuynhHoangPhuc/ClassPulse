import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import {
  AssessmentListPage,
  AssessmentWizardPage,
  AssessmentPreviewPage,
  AssessmentTakingPage,
  AssessmentResultsPage,
  TeacherSubmissionsPage,
  TeacherSubmissionDetailPage,
} from "@/features/assessments";

export const assessmentsListRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/assessments",
  component: AssessmentListPage,
});

export const assessmentNewRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/assessments/new",
  component: AssessmentWizardPage,
});

export const assessmentEditRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/assessments/$assessmentId/edit",
  component: function AssessmentEditRoute() {
    // Reuse wizard for editing — future enhancement
    return <AssessmentWizardPage />;
  },
});

export const assessmentPreviewRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/assessments/$assessmentId/preview",
  component: function AssessmentPreviewRoute() {
    const { assessmentId } = assessmentPreviewRoute.useParams();
    return <AssessmentPreviewPage assessmentId={assessmentId} />;
  },
});

// ── Assessment Taking (student) ──────────────────────────────────────────────

export const assessmentTakingRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/classrooms/$classroomId/assessments/$assessmentId/take",
  component: function AssessmentTakingRoute() {
    const { classroomId, assessmentId } = assessmentTakingRoute.useParams();
    return <AssessmentTakingPage assessmentId={assessmentId} classroomId={classroomId} />;
  },
});

export const assessmentResultsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/classrooms/$classroomId/assessments/$assessmentId/attempts/$attemptId/results",
  component: function AssessmentResultsRoute() {
    const { attemptId, classroomId, assessmentId } = assessmentResultsRoute.useParams();
    return <AssessmentResultsPage attemptId={attemptId} classroomId={classroomId} assessmentId={assessmentId} />;
  },
});

// ── Teacher Submissions ──────────────────────────────────────────────────────

export const teacherSubmissionsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/classrooms/$classroomId/assessments/$assessmentId/submissions",
  component: function TeacherSubmissionsRoute() {
    const { classroomId, assessmentId } = teacherSubmissionsRoute.useParams();
    return <TeacherSubmissionsPage classroomId={classroomId} assessmentId={assessmentId} />;
  },
});

export const teacherSubmissionDetailRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/classrooms/$classroomId/assessments/$assessmentId/attempts/$attemptId/detail",
  component: function TeacherSubmissionDetailRoute() {
    const { classroomId, assessmentId, attemptId } = teacherSubmissionDetailRoute.useParams();
    return <TeacherSubmissionDetailPage attemptId={attemptId} classroomId={classroomId} assessmentId={assessmentId} />;
  },
});
