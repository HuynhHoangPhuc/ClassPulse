import { createRoute } from "@tanstack/react-router";
import { authedLayout } from "./authed-layout";
import { ClassroomListPage, ClassroomDetailPage } from "@/features/classrooms";

export const classroomsListRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/classrooms",
  component: ClassroomListPage,
});

export const classroomDetailRoute = createRoute({
  getParentRoute: () => authedLayout,
  path: "/classrooms/$classroomId",
  component: function ClassroomDetailRoute() {
    const { classroomId } = classroomDetailRoute.useParams();
    return <ClassroomDetailPage classroomId={classroomId} />;
  },
});
