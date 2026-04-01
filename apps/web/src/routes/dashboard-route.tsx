import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const dashboardRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/dashboard",
  component: DashboardPage,
});

// --- KPI placeholder card data per role ---

const teacherKpis = [
  { label: "Total Students", value: "—", description: "Across all classrooms" },
  { label: "Active Assessments", value: "—", description: "In progress right now" },
  { label: "Questions Bank", value: "—", description: "Total authored questions" },
  { label: "Avg. Score", value: "—", description: "Last 30 days" },
];

// --- Role-based content components ---

function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Your teaching dashboard is coming soon."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {teacherKpis.map((kpi) => (
          <Card key={kpi.label} variant="standard">
            <p
              className="text-xs font-medium uppercase tracking-wider mb-1"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              {kpi.label}
            </p>
            <p
              className="text-3xl font-bold mb-1"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {kpi.value}
            </p>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              {kpi.description}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StudentDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your learning dashboard is coming soon."
      />
    </div>
  );
}

function ParentDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your child's progress dashboard is coming soon."
      />
    </div>
  );
}

// --- Route component: role hardcoded to "teacher" until Clerk metadata is wired ---

type Role = "teacher" | "student" | "parent";

function DashboardPage() {
  // TODO: Derive role from Clerk user public metadata once available.
  // Cast through unknown to prevent TS from narrowing the literal "teacher"
  // to a single-member type, which would make the guard comparisons unreachable.
  const role = "teacher" as unknown as Role;

  if (role === "student") return <StudentDashboard />;
  if (role === "parent") return <ParentDashboard />;
  return <TeacherDashboard />;
}
