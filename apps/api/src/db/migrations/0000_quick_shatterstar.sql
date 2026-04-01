CREATE TABLE `assessment_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`student_id` text NOT NULL,
	`classroom_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`is_auto_submitted` integer DEFAULT 0 NOT NULL,
	`score` real,
	`total_possible` real,
	`status` text DEFAULT 'in_progress' NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assessment_questions` (
	`assessment_id` text NOT NULL,
	`question_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`custom_score` real,
	`custom_penalty` real,
	PRIMARY KEY(`assessment_id`, `question_id`),
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`time_limit_minutes` integer,
	`score_per_correct` real DEFAULT 1 NOT NULL,
	`penalty_per_incorrect` real DEFAULT 0 NOT NULL,
	`shuffle_questions` integer DEFAULT 0 NOT NULL,
	`shuffle_options` integer DEFAULT 0 NOT NULL,
	`show_results` text DEFAULT 'immediately' NOT NULL,
	`parent_detail_view` text DEFAULT 'scores_only' NOT NULL,
	`generation_config` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attempt_answers` (
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_option_id` text NOT NULL,
	`is_correct` integer NOT NULL,
	`answered_at` integer NOT NULL,
	PRIMARY KEY(`attempt_id`, `question_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `assessment_attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `classroom_members` (
	`classroom_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`classroom_id`, `user_id`),
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`invite_code` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classrooms_invite_code_unique` ON `classrooms` (`invite_code`);--> statement-breakpoint
CREATE TABLE `comment_mentions` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`comment_id`, `user_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_comment_id` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` text NOT NULL,
	`message` text NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `parent_student` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`student_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`classroom_id` text NOT NULL,
	`author_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`assessment_id` text,
	`due_date` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `question_tags` (
	`question_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`question_id`, `tag_id`),
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`content` text NOT NULL,
	`options` text NOT NULL,
	`complexity` integer NOT NULL,
	`complexity_type` text NOT NULL,
	`explanation` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`teacher_id` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
