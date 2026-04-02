import { ChevronDown } from "lucide-react"

interface Student {
  studentId: string
  name: string
  email: string
  avatarUrl: string | null
}

interface StudentSelectorProps {
  students: Student[]
  selectedId: string
  onChange: (studentId: string) => void
}

export function StudentSelector({ students, selectedId, onChange }: StudentSelectorProps) {
  if (students.length <= 1) return null

  return (
    <div className="relative inline-flex items-center gap-2">
      <label
        htmlFor="student-selector"
        className="text-sm font-medium"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Viewing:
      </label>
      <div className="relative">
        <select
          id="student-selector"
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm font-medium border cursor-pointer"
          style={{
            backgroundColor: "var(--color-card)",
            borderColor: "var(--color-border)",
            color: "var(--color-foreground)",
          }}
        >
          {students.map((s) => (
            <option key={s.studentId} value={s.studentId}>
              {s.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--color-muted-foreground)" }}
        />
      </div>
    </div>
  )
}
