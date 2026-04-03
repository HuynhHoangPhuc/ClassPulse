import { useUser } from "@clerk/clerk-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DarkModeToggle } from "@/components/layout/dark-mode-toggle";
import { useCurrentUser } from "@/hooks/use-current-user";
import { User, Palette, Bell } from "lucide-react";

export function SettingsPage() {
  const { user: clerkUser } = useUser();
  const { data: appUser } = useCurrentUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile and preferences."
      />

      {/* Profile */}
      <Card variant="standard">
        <div className="flex items-center gap-3 mb-4">
          <User size={18} style={{ color: "var(--color-primary)" }} />
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-foreground)" }}
          >
            Profile
          </h2>
        </div>
        <div className="space-y-3">
          <SettingsRow label="Name" value={clerkUser?.fullName ?? appUser?.name ?? "—"} />
          <SettingsRow label="Email" value={clerkUser?.primaryEmailAddress?.emailAddress ?? appUser?.email ?? "—"} />
          <SettingsRow label="Role" value={appUser?.role ? appUser.role.charAt(0).toUpperCase() + appUser.role.slice(1) : "—"} />
        </div>
      </Card>

      {/* Appearance */}
      <Card variant="standard">
        <div className="flex items-center gap-3 mb-4">
          <Palette size={18} style={{ color: "var(--color-primary)" }} />
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-foreground)" }}
          >
            Appearance
          </h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>Theme</p>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>Toggle between light and dark mode</p>
          </div>
          <DarkModeToggle />
        </div>
      </Card>

      {/* Notifications */}
      <Card variant="standard">
        <div className="flex items-center gap-3 mb-4">
          <Bell size={18} style={{ color: "var(--color-primary)" }} />
          <h2
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-foreground)" }}
          >
            Notifications
          </h2>
        </div>
        <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          Notification preferences coming soon.
        </p>
      </Card>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{value}</span>
    </div>
  );
}
