ALTER TABLE `assessment_attempts` ADD `tab_switch_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `assessment_attempts` ADD `question_order` text;--> statement-breakpoint
CREATE INDEX `attempts_student_id_idx` ON `assessment_attempts` (`student_id`);--> statement-breakpoint
CREATE INDEX `attempts_assessment_id_idx` ON `assessment_attempts` (`assessment_id`);--> statement-breakpoint
CREATE INDEX `attempts_classroom_assessment_idx` ON `assessment_attempts` (`classroom_id`,`assessment_id`);--> statement-breakpoint
CREATE INDEX `comments_post_id_idx` ON `comments` (`post_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_id_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `posts_classroom_id_idx` ON `posts` (`classroom_id`);