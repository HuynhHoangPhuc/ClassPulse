import type { UserRole } from "../constants/roles.js";
import type { PostType } from "../constants/post-types.js";

export interface Classroom {
  id: string;
  teacherId: string;
  name: string;
  description: string | null;
  inviteCode: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClassroomMember {
  classroomId: string;
  userId: string;
  role: UserRole;
  joinedAt: number;
}

export interface Post {
  id: string;
  classroomId: string;
  authorId: string;
  type: PostType;
  title: string;
  content: string | null;
  assessmentId: string | null;
  dueDate: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommentMention {
  commentId: string;
  userId: string;
}
