CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`content_type` text NOT NULL,
	`encrypted` integer DEFAULT false NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_images_session` ON `images` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_images_created` ON `images` (`created_at`);