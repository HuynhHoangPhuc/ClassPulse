import { useState } from "react";
import { QuestionPicker } from "./question-picker";
import { AutoGenConfig, type GenConfig } from "./auto-gen-config";

type Mode = "manual" | "auto";

interface WizardStepQuestionsProps {
  questionIds: string[];
  onQuestionIdsChange: (ids: string[]) => void;
  genConfig: GenConfig;
  onGenConfigChange: (config: GenConfig) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function WizardStepQuestions({
  questionIds,
  onQuestionIdsChange,
  genConfig,
  onGenConfigChange,
  mode,
  onModeChange,
}: WizardStepQuestionsProps) {
  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div
        className="flex rounded-xl border overflow-hidden w-fit"
        style={{ borderColor: "var(--color-border)" }}
      >
        {(["manual", "auto"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className="px-4 py-2 text-sm font-medium capitalize transition-colors"
            style={{
              background: mode === m ? "var(--color-primary)" : "var(--color-card)",
              color: mode === m ? "#fff" : "var(--color-muted-foreground)",
            }}
          >
            {m === "manual" ? "Manual Select" : "Auto Generate"}
          </button>
        ))}
      </div>

      {/* Content */}
      {mode === "manual" ? (
        <QuestionPicker selected={questionIds} onChange={onQuestionIdsChange} />
      ) : (
        <AutoGenConfig config={genConfig} onChange={onGenConfigChange} />
      )}
    </div>
  );
}
