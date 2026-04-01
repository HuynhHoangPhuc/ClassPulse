import type { UserRole } from "../constants/roles.js";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

export interface ParentStudent {
  id: string;
  parentId: string;
  studentId: string;
  createdAt: number;
}
