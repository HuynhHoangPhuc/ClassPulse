import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@clerk/clerk-react"
import { ClipboardList, Users, Calendar, GraduationCap } from "lucide-react"
import { fetchApi } from "@/lib/fetch-api"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Card } from "@/components/ui/card"
import { StudentSelector } from "./student-selector"
import { ScoreGaugeCard } from "./score-gauge-card"
import { ScoreTrendChart } from "./score-trend-chart"
import { TagPerformanceChart } from "./tag-performance-chart"
import { ActivityFeed } from "./activity-feed"
import { AssessmentHistoryTable } from "./assessment-history-table"
import { ClassroomOverviewCards } from "./classroom-overview-card"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Student {
  studentId: string
  name: string
  email: string
  avatarUrl: string | null
}

interface Overview {
  avgScore: number
  totalAttempts: number
  totalClassrooms: number
  attemptsThisWeek: number
}

interface TrendPoint { date: string; avg: number }

interface TagPerf {
  tagId: string; name: string; color: string | null
  accuracy: number; totalAnswers: number
}

interface ActivityItem {
  type: "assessment_completed"; id: string; timestamp: number
  description: string; score: number | null; totalPossible: number | null
}

interface HistoryItem {
  attemptId: string; assessmentTitle: string; classroomName: string
  startedAt: number; submittedAt: number | null; score: number | null
  totalPossible: number | null; timeTaken: number | null; parentDetailView: string
}

interface ClassroomInfo {
  classroomId: string; classroomName: string; teacherName: string
  totalAssessments: number; completedAssessments: number; completionRate: number
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ParentDashboardPage() {
  const { getToken } = useAuth()
  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [historyCursor, setHistoryCursor] = useState<string | undefined>()
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])

  // Fetch linked students
  const { data: studentsData, isLoading: studentsLoading } = useQuery<{ items: Student[] }>({
    queryKey: ["parent", "students"],
    queryFn: async () => {
      const t = await getToken()
      return fetchApi("/api/parent/students", {}, t) as Promise<{ items: Student[] }>
    },
  })

  const students = studentsData?.items ?? []

  // Auto-select first student
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].studentId)
    }
  }, [students, selectedStudentId])

  // Reset history when student changes
  useEffect(() => {
    setHistoryCursor(undefined)
    setHistoryItems([])
  }, [selectedStudentId])

  const enabled = !!selectedStudentId

  // Overview KPIs
  const { data: overview } = useQuery<Overview>({
    queryKey: ["parent", "overview", selectedStudentId],
    queryFn: async () => {
      const t = await getToken()
      return fetchApi(`/api/parent/students/${selectedStudentId}/overview`, {}, t) as Promise<Overview>
    },
    enabled,
  })

  // Score trend
  const { data: trendData } = useQuery<{ items: TrendPoint[] }>({
    queryKey: ["parent", "trend", selectedStudentId],
    queryFn: async () => {
      const t = await getToken()
      return fetchApi(`/api/parent/students/${selectedStudentId}/trend`, {}, t) as Promise<{ items: TrendPoint[] }>
    },
    enabled,
  })

  // Tag performance
  const { data: tagsData } = useQuery<{ items: TagPerf[] }>({
    queryKey: ["parent", "tags", selectedStudentId],
    queryFn: async () => {
      const t = await getToken()
      return fetchApi(`/api/parent/students/${selectedStudentId}/tags`, {}, t) as Promise<{ items: TagPerf[] }>
    },
    enabled,
  })

  // Activity feed
  const { data: activityData, isLoading: activityLoading } = useQuery<{ items: ActivityItem[] }>({
    queryKey: ["parent", "activity", selectedStudentId],
    queryFn: async () => {
      const t = await getToken()
      return fetchApi(`/api/parent/students/${selectedStudentId}/activity?limit=10`, {}, t) as Promise<{ items: ActivityItem[] }>
    },
    enabled,
  })

  // Assessment history (paginated)
  const { data: historyData, isLoading: historyLoading } = useQuery<{ items: HistoryItem[]; nextCursor: string | null }>({
    queryKey: ["parent", "history", selectedStudentId, historyCursor],
    queryFn: async () => {
      const t = await getToken()
      const params = new URLSearchParams({ limit: "10" })
      if (historyCursor) params.set("cursor", historyCursor)
      const result = await fetchApi(
        `/api/parent/students/${selectedStudentId}/history?${params}`, {}, t,
      ) as { items: HistoryItem[]; nextCursor: string | null }
      // Append to existing items
      setHistoryItems((prev) => historyCursor ? [...prev, ...result.items] : result.items)
      return result
    },
    enabled,
  })

  // Classrooms
  const { data: classroomsData, isLoading: classroomsLoading } = useQuery<{ items: ClassroomInfo[] }>({
    queryKey: ["parent", "classrooms", selectedStudentId],
    queryFn: async () => {
      const t = await getToken()
      return fetchApi(`/api/parent/students/${selectedStudentId}/classrooms`, {}, t) as Promise<{ items: ClassroomInfo[] }>
    },
    enabled,
  })

  // ── Loading / Empty states ────────────────────────────────────────────────

  if (studentsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Parent Dashboard" description="Loading..." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--color-muted)" }} />
          ))}
        </div>
      </div>
    )
  }

  if (students.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Parent Dashboard" description="Monitor your child's progress" />
        <EmptyState
          icon={<GraduationCap size={32} />}
          headline="No students linked"
          description="Ask your child's teacher to add you as a parent in their classroom."
        />
      </div>
    )
  }

  // ── KPI cards data ────────────────────────────────────────────────────────

  const kpis = [
    {
      label: "Assessments Taken",
      value: String(overview?.totalAttempts ?? 0),
      icon: <ClipboardList size={16} />,
    },
    {
      label: "Classrooms",
      value: String(overview?.totalClassrooms ?? 0),
      icon: <Users size={16} />,
    },
    {
      label: "This Week",
      value: String(overview?.attemptsThisWeek ?? 0),
      icon: <Calendar size={16} />,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header + student selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="Parent Dashboard"
          description="Monitor your child's academic progress"
        />
        <StudentSelector
          students={students}
          selectedId={selectedStudentId}
          onChange={(id) => setSelectedStudentId(id)}
        />
      </div>

      {/* Row 1: KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreGaugeCard score={overview?.avgScore ?? 0} label="Overall Score" />
        {kpis.map((kpi) => (
          <Card key={kpi.label} variant="standard">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: "color-mix(in srgb, var(--color-secondary) 15%, transparent)",
                  color: "var(--color-secondary)",
                }}
              >
                {kpi.icon}
              </div>
            </div>
            <p
              className="text-2xl font-bold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-foreground)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {kpi.value}
            </p>
            <p
              className="text-xs font-medium uppercase tracking-wider mt-1"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              {kpi.label}
            </p>
          </Card>
        ))}
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreTrendChart data={trendData?.items ?? []} />
        <TagPerformanceChart data={tagsData?.items ?? []} />
      </div>

      {/* Row 3: Activity + History */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <ActivityFeed items={activityData?.items ?? []} isLoading={activityLoading} />
        </div>
        <div className="lg:col-span-3">
          <AssessmentHistoryTable
            items={historyItems}
            isLoading={historyLoading}
            hasMore={!!historyData?.nextCursor}
            onLoadMore={() => setHistoryCursor(historyData?.nextCursor ?? undefined)}
          />
        </div>
      </div>

      {/* Row 4: Classroom overview */}
      <div>
        <p
          className="text-sm font-semibold mb-3"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
        >
          Classrooms
        </p>
        <ClassroomOverviewCards
          classrooms={classroomsData?.items ?? []}
          isLoading={classroomsLoading}
        />
      </div>
    </div>
  )
}
