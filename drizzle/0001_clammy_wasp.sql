CREATE TABLE `billing_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_system_id` varchar(50) NOT NULL,
	`management_no` varchar(50),
	`region` varchar(50),
	`vehicle_no` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`rrn` varchar(14),
	`mobile` varchar(20),
	`address` text,
	`phone` varchar(20),
	`certificate_date` date,
	`certificate_no` varchar(50),
	`license_no` varchar(50),
	`vehicle_type` varchar(50),
	`fuel_type` varchar(50),
	`business_no` varchar(20),
	`company` varchar(100),
	`join_date` date,
	`memo` text,
	`member_type` varchar(20) NOT NULL,
	`billing_type` varchar(20) NOT NULL,
	`billing_start_month` varchar(7) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT '대기',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billing_candidate_id` int NOT NULL,
	`billing_month` varchar(7) NOT NULL,
	`amount` int NOT NULL,
	`is_paid` int DEFAULT 0,
	`paid_date` date,
	`paid_amount` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `closure_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_system_id` varchar(50) NOT NULL,
	`closure_type` varchar(20) NOT NULL,
	`management_no` varchar(50) NOT NULL,
	`region` varchar(50),
	`vehicle_no` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`receipt_date` date,
	`process_date` date NOT NULL,
	`exclude_start_month` varchar(7) NOT NULL,
	`unpaid_amount_at_closure` int DEFAULT 0,
	`reflect_status` varchar(20) NOT NULL DEFAULT '확인필요',
	`memo` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `closure_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`source_id` varchar(50),
	`target_id` varchar(50),
	`status` varchar(20) NOT NULL,
	`message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_logs_id` PRIMARY KEY(`id`)
);
