CREATE TABLE "starred_documents" (
	"user_id" varchar(255) NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "starred_documents_user_id_document_id_pk" PRIMARY KEY("user_id","document_id")
);
--> statement-breakpoint
ALTER TABLE "starred_documents" ADD CONSTRAINT "starred_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "starred_documents_user_created_idx" ON "starred_documents" USING btree ("user_id","created_at" DESC NULLS LAST);