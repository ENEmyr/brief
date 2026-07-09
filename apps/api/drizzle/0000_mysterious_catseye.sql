CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`title` text NOT NULL,
	`saved` integer DEFAULT false NOT NULL,
	`encrypted` integer DEFAULT false NOT NULL,
	`enc_params` text,
	`created_at` integer NOT NULL,
	`last_opened_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);