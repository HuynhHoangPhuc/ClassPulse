import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { WizardStepBasicInfo, type BasicInfo } from "./wizard-step-basic-info";
import { WizardStepQuestions } from "./wizard-step-questions";
import { WizardStepSettings, type SettingsData } from "./wizard-step-settings";
import type { GenConfig } from "./auto-gen-config";

const STEPS = ["Basic Info", "Questions", "Settings"];
const STORAGE_KEY = "assessment-wizard-state";

type QuestionMode = "manual" | "auto";

interface WizardState {
  basicInfo: BasicInfo;
  questionIds: string[];
  genConfig: GenConfig;
  questionMode: QuestionMode;
  settings: SettingsData;
}

const DEFAULT_STATE: WizardState = {
  basicInfo: { title: "", description: "", type: "test", timeLimitMinutes: null },
  questionIds: [],
  genConfig: { totalQuestions: 20, scorePerCorrect: 1, penaltyPerIncorrect: 0, tags: [] },
  questionMode: "manual",
  settings: {
    shuffleQuestions: false,
    shuffleOptions: false,
    showResults: "immediately",
    scorePerCorrect: 1,
    penaltyPerIncorrect: 0,
  },
};

function loadState(): WizardState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function AssessmentWizardPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(loadState);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [shortfalls, setShortfalls] = useState<Array<{ tagId: string; complexity: number; needed: number; available: number }>>([]);

  // Persist wizard state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (state.questionMode === "auto") {
        // Auto-generate
        return fetchApi("/api/assessments/generate", {
          method: "POST",
          body: JSON.stringify({
            title: state.basicInfo.title,
            description: state.basicInfo.description || null,
            type: state.basicInfo.type,
            timeLimitMinutes: state.basicInfo.timeLimitMinutes,
            totalQuestions: state.genConfig.totalQuestions,
            scorePerCorrect: state.settings.scorePerCorrect,
            penaltyPerIncorrect: state.settings.penaltyPerIncorrect,
            shuffleQuestions: state.settings.shuffleQuestions,
            shuffleOptions: state.settings.shuffleOptions,
            showResults: state.settings.showResults,
            tags: state.genConfig.tags.map((t) => ({
              tagId: t.tagId,
              percent: t.percent,
              complexities: t.complexities.filter((c) => c.percent > 0),
            })),
          }),
        }, token) as Promise<{ assessment: unknown; shortfalls: typeof shortfalls }>;
      }
      // Manual create
      return fetchApi("/api/assessments", {
        method: "POST",
        body: JSON.stringify({
          title: state.basicInfo.title,
          description: state.basicInfo.description || null,
          type: state.basicInfo.type,
          timeLimitMinutes: state.basicInfo.timeLimitMinutes,
          scorePerCorrect: state.settings.scorePerCorrect,
          penaltyPerIncorrect: state.settings.penaltyPerIncorrect,
          shuffleQuestions: state.settings.shuffleQuestions,
          shuffleOptions: state.settings.shuffleOptions,
          showResults: state.settings.showResults,
          questionIds: state.questionIds,
        }),
      }, token);
    },
    onSuccess: (data) => {
      sessionStorage.removeItem(STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      // Show shortfalls if auto-generated
      const result = data as { shortfalls?: typeof shortfalls };
      if (result.shortfalls && result.shortfalls.length > 0) {
        setShortfalls(result.shortfalls);
      } else {
        navigate({ to: "/assessments" });
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create assessment");
    },
  });

  function canProceed(): boolean {
    if (step === 0) return state.basicInfo.title.trim().length > 0;
    if (step === 1) {
      if (state.questionMode === "manual") return state.questionIds.length > 0;
      return state.genConfig.tags.length > 0 && state.genConfig.totalQuestions > 0;
    }
    return true;
  }

  function handleNext() {
    if (!canProceed()) {
      if (step === 0) setValidationError("Title is required.");
      if (step === 1) {
        setValidationError(
          state.questionMode === "manual"
            ? "Select at least one question."
            : "Add at least one tag for auto-generation.",
        );
      }
      return;
    }
    setValidationError(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setError(null);
      createMutation.mutate();
    }
  }

  // If showing shortfall warnings after auto-gen success
  if (shortfalls.length > 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Assessment Created" description="Created with some shortfalls" />
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "var(--color-warning)", background: "var(--color-warning)/5" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: "var(--color-warning)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--color-warning)" }}>
              Some question slots could not be filled
            </span>
          </div>
          {shortfalls.map((sf, i) => (
            <p key={i} className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              Tag {sf.tagId}, Level {sf.complexity}: needed {sf.needed}, available {sf.available}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/assessments" })}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          Go to Assessments
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Assessment"
        description={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { if (i < step) { setStep(i); setValidationError(null); } }}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: i === step ? "var(--color-primary)" : i < step ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: i <= step ? "var(--color-primary)" : "var(--color-muted)",
                  color: i <= step ? "#fff" : "var(--color-muted-foreground)",
                }}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-px" style={{ background: "var(--color-border)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div
        className="rounded-[var(--radius-card)] border p-6"
        style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
      >
        {step === 0 && (
          <WizardStepBasicInfo
            data={state.basicInfo}
            onChange={(basicInfo) => setState({ ...state, basicInfo })}
          />
        )}
        {step === 1 && (
          <WizardStepQuestions
            questionIds={state.questionIds}
            onQuestionIdsChange={(questionIds) => setState({ ...state, questionIds })}
            genConfig={state.genConfig}
            onGenConfigChange={(genConfig) => setState({ ...state, genConfig })}
            mode={state.questionMode}
            onModeChange={(questionMode) => setState({ ...state, questionMode })}
          />
        )}
        {step === 2 && (
          <WizardStepSettings
            data={state.settings}
            onChange={(settings) => setState({ ...state, settings })}
            questionCount={state.questionMode === "manual" ? state.questionIds.length : state.genConfig.totalQuestions}
            assessmentTitle={state.basicInfo.title}
            assessmentType={state.basicInfo.type}
          />
        )}
      </div>

      {/* Validation / error message */}
      {(validationError || error) && (
        <p
          className="text-sm px-3 py-2 rounded-[var(--radius-card)] border"
          style={{ borderColor: "var(--color-destructive)", color: "var(--color-destructive)" }}
        >
          {validationError || error}
        </p>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 0 ? setStep(step - 1) : navigate({ to: "/assessments" })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)]"
          style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
        >
          <ArrowLeft size={14} />
          {step > 0 ? "Back" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--color-primary)", color: "#fff" }}
        >
          {createMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : step === STEPS.length - 1 ? (
            "Create Assessment"
          ) : (
            <>Next <ArrowRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  );
}
