CREATE TABLE "RefreshToken" (
	"id" uuid PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"revokedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "RefreshToken_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "UserAccount" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"displayName" text,
	"avatarUrl" text,
	"role" text DEFAULT 'user' NOT NULL,
	"googleSubjectId" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "UserAccount_email_unique" UNIQUE("email"),
	CONSTRAINT "UserAccount_googleSubjectId_unique" UNIQUE("googleSubjectId")
);
--> statement-breakpoint
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_UserAccount_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."UserAccount"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "UserAccount_createdAt_idx" ON "UserAccount" USING btree ("createdAt");