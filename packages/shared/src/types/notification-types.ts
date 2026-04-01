import type { NotificationType, ReferenceType } from "../constants/notification-types.js";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  referenceType: ReferenceType;
  referenceId: string;
  message: string;
  isRead: boolean;
  createdAt: number;
}
