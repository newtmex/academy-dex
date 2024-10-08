CREATE TABLE IF NOT EXISTS "comm_chats" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "comm_chats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tgID" bigint NOT NULL,
	"username" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tgUsers" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "tgUsers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tgID" bigint NOT NULL,
	"refID" text,
	"referrerID" text,
	"isBot" boolean DEFAULT true,
	"firstName" text NOT NULL,
	"lastName" text,
	"username" text,
	"languageCode" text,
	"groupChatStatus" text,
	"joinReqSent" boolean DEFAULT false,
	CONSTRAINT "tgUsers_refID_unique" UNIQUE("refID")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"address" varchar PRIMARY KEY NOT NULL,
	"idInContract" bigint,
	"refID" varchar,
	"tgID" bigint,
	"referrerID" varchar,
	CONSTRAINT "users_address_unique" UNIQUE("address"),
	CONSTRAINT "users_idInContract_unique" UNIQUE("idInContract"),
	CONSTRAINT "users_refID_unique" UNIQUE("refID"),
	CONSTRAINT "users_tgID_unique" UNIQUE("tgID")
);
