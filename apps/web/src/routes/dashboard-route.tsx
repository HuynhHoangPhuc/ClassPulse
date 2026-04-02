import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ParentDashboardPage } from "@/features/dashboard/parent-dashboard-page";

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

// --- Route component: derives role from user profile ---

function DashboardPage() {
  const { data: user, isLoading } = useCurrentUser();
  const role = user?.role ?? "teacher";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: "var(--color-muted)" }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--color-muted)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (role === "parent") return <ParentDashboardPage />;
  if (role === "student") return <StudentDashboard />;
  return <TeacherDashboard />;
}
