import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import { QuestionListPage, QuestionEditorPage } from "@/features/questions";

export const questionsRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/questions",
  component: QuestionListPage,
});

export const questionNewRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/questions/new",
  component: () => <QuestionEditorPage />,
});

export const questionEditRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/questions/$questionId/edit",
  component: function QuestionEditRoute() {
    const { questionId } = questionEditRoute.useParams();
    return <QuestionEditorPage questionId={questionId} />;
  },
});
