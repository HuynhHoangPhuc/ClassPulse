import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/fetch-api";
import { AssessmentTimer } from "./assessment-timer";
import { AssessmentQuestionView } from "./assessment-question-view";
import { AssessmentQuestionGrid } from "./assessment-question-grid";
import { AssessmentAutoSubmitDialog } from "./assessment-auto-submit-dialog";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";

interface AttemptQuestion {
  questionId: string;
  orderIndex: number;
  content: string;
  options: Array<{ id: string; text: string }>;
  complexity: number;
  complexityType: string;
}

interface AttemptState {
  attemptId: string;
  status: string;
  assessmentTitle: string;
  timeLimitSeconds: number | null;
  serverTime: number;
  timeRemainingSeconds: number | null;
  questions: AttemptQuestion[];
  answers: Record<string, string>;
  scorePerCorrect: number;
  penaltyPerIncorrect: number;
}

interface StartAttemptResult {
  attemptId: string;
  assessmentTitle: string;
  timeLimitSeconds: number | null;
  serverTime: number;
  timeRemainingSeconds: number | null;
  questions: AttemptQuestion[];
  scorePerCorrect: number;
  penaltyPerIncorrect: number;
}

interface SubmitResult {
  score: number;
  totalPossible: number;
  isAutoSubmitted: boolean;
}

interface AssessmentTakingPageProps {
  assessmentId: string;
  classroomId: string;
}

export function AssessmentTakingPage({ assessmentId, classroomId }: AssessmentTakingPageProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState(0);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [showAutoSubmitDialog, setShowAutoSubmitDialog] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Start or resume attempt
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const token = await getToken();
      try {
        // Try starting a new attempt
        const result = await fetchApi("/api/attempts", {
          method: "POST",
          body: JSON.stringify({ assessmentId, classroomId }),
        }, token) as StartAttemptResult;

        if (cancelled) return;
        setAttemptId(result.attemptId);
        setQuestions(result.questions);
        setTimeRemainingSeconds(result.timeRemainingSeconds);
        setServerTime(result.serverTime);
        setAssessmentTitle(result.assessmentTitle);
        setAnswers({});
      } catch (err) {
        // Might already have in-progress attempt — try fetching existing
        if (err instanceof Error && err.message.includes("in-progress")) {
          // We need the attempt ID — this is a limitation, but for now show error
          setError("You already have an in-progress attempt. Please refresh to resume.");
        } else {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to start");
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [assessmentId, classroomId, getToken]);

  // Tab visibility detection (anti-cheat)
  useEffect(() => {
    if (!attemptId) return;
    const handler = async () => {
      if (document.visibilityState === "visible" && attemptId) {
        const token = await getToken();
        fetchApi(`/api/attempts/${attemptId}/tab-switch`, { method: "POST" }, token).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [attemptId, getToken]);

  // Save answer (optimistic)
  const handleSelectOption = useCallback(async (optionId: string) => {
    if (!attemptId) return;
    const qid = questions[currentIdx]?.questionId;
    if (!qid) return;

    // Optimistic update
    setAnswers((prev) => ({ ...prev, [qid]: optionId }));

    const prevOptionId = answers[qid];
    const token = await getToken();
    fetchApi(`/api/attempts/${attemptId}/answers/${qid}`, {
      method: "PUT",
      body: JSON.stringify({ selectedOptionId: optionId }),
    }, token).catch(() => {
      // Revert optimistic update on failure
      setAnswers((prev) => {
        if (prevOptionId) return { ...prev, [qid]: prevOptionId };
        const next = { ...prev };
        delete next[qid];
        return next;
      });
    });
  }, [attemptId, questions, currentIdx, getToken]);

  // Submit attempt
  const handleSubmit = useCallback(async (auto = false) => {
    if (!attemptId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const result = await fetchApi(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
      }, token) as SubmitResult;
      setSubmitResult(result);
      if (auto) {
        setShowAutoSubmitDialog(true);
      } else {
        navigate({ to: "/classrooms/$classroomId/assessments/$assessmentId/attempts/$attemptId/results", params: { classroomId, assessmentId, attemptId } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [attemptId, isSubmitting, getToken, navigate, classroomId, assessmentId]);

  const handleTimeUp = useCallback(() => {
    handleSubmit(true);
  }, [handleSubmit]);

  const handleToggleFlag = useCallback(() => {
    const qid = questions[currentIdx]?.questionId;
    if (!qid) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }, [questions, currentIdx]);

  // Loading state
  if (isStarting) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--color-background)" }}>
        <div className="animate-pulse text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          Loading assessment...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--color-background)" }}>
        <div className="text-center space-y-3">
          <p className="text-sm" style={{ color: "var(--color-destructive)" }}>{error}</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/classrooms/$classroomId", params: { classroomId } })}
            className="px-4 py-2 rounded-xl text-sm border transition-colors hover:bg-[var(--color-muted)]"
            style={{ borderColor: "var(--color-border)" }}
          >
            Back to Classroom
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentIdx];
  const answeredIds = new Set(Object.keys(answers));
  const answeredCount = answeredIds.size;
  const questionIds = questions.map((q) => q.questionId);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-background)" }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
      >
        <h1 className="text-sm font-semibold truncate max-w-[200px]" style={{ color: "var(--color-foreground)" }}>
          {assessmentTitle}
        </h1>
        <div className="flex items-center gap-4">
          <AssessmentTimer
            timeRemainingSeconds={timeRemainingSeconds}
            serverTime={serverTime}
            onTimeUp={handleTimeUp}
          />
          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            {answeredCount} / {questions.length}
          </span>
          <button
            type="button"
            onClick={() => setShowConfirmSubmit(true)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            <Send size={14} /> Submit
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4">
        {/* Question grid */}
        <AssessmentQuestionGrid
          total={questions.length}
          currentIndex={currentIdx}
          answeredIds={answeredIds}
          flaggedIds={flagged}
          questionIds={questionIds}
          onNavigate={setCurrentIdx}
        />

        {/* Question view */}
        {question && (
          <AssessmentQuestionView
            questionIndex={currentIdx}
            totalQuestions={questions.length}
            content={question.content}
            complexity={question.complexity}
            options={question.options}
            selectedOptionId={answers[question.questionId] ?? null}
            isFlagged={flagged.has(question.questionId)}
            onSelectOption={handleSelectOption}
            onToggleFlag={handleToggleFlag}
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            <ArrowLeft size={14} /> Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            disabled={currentIdx === questions.length - 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
            style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
          >
            Next <ArrowRight size={14} />
          </button>
        </div>
      </main>

      {/* Confirm submit dialog */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-[var(--radius-card)] border p-6 max-w-sm w-full mx-4 space-y-4"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            <h2 className="text-base font-semibold" style={{ color: "var(--color-foreground)" }}>
              Submit Assessment?
            </h2>
            <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
              You have answered {answeredCount} of {questions.length} questions.
              {questions.length - answeredCount > 0 && (
                <> <strong>{questions.length - answeredCount}</strong> unanswered questions will be scored as 0.</>
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 px-4 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--color-muted)]"
                style={{ borderColor: "var(--color-border)", color: "var(--color-foreground)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirmSubmit(false); handleSubmit(false); }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                {isSubmitting ? "Submitting..." : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-submit dialog */}
      <AssessmentAutoSubmitDialog
        isOpen={showAutoSubmitDialog}
        score={submitResult?.score}
        totalPossible={submitResult?.totalPossible}
        showScore={!!submitResult}
        onViewResults={() => {
          if (attemptId) {
            navigate({ to: "/classrooms/$classroomId/assessments/$assessmentId/attempts/$attemptId/results", params: { classroomId, assessmentId, attemptId } });
          }
        }}
      />
    </div>
  );
}
