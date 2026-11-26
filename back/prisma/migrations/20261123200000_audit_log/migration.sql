-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'DOWNLOAD', 'VIEW_LOG');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "changes" JSONB,
    "detail" JSONB,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "actor_id" INTEGER,
    "actor_name" TEXT,
    "actor_email" TEXT,
    "method" TEXT,
    "route" TEXT,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "AuditLog_actor_id_created_at_idx" ON "AuditLog"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entity_id_idx" ON "AuditLog"("entity", "entity_id");

-- A trilha só recebe inserção (ASVS 5.0, 16.4.2): alterar ou apagar um
-- registro, inclusive pela aplicação, falha no banco.
CREATE FUNCTION "audit_log_append_only"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog aceita apenas inserção';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_no_update_delete"
    BEFORE UPDATE OR DELETE ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

CREATE TRIGGER "AuditLog_no_truncate"
    BEFORE TRUNCATE ON "AuditLog"
    FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_append_only"();
