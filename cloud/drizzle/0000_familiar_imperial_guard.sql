CREATE TABLE `bankbook_document_chunks` (
	`user_id` text NOT NULL,
	`mutation_id` text NOT NULL,
	`part` integer NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`user_id`, `mutation_id`, `part`)
);
--> statement-breakpoint
CREATE TABLE `bankbook_documents` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`document` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_mutation` text NOT NULL
);
