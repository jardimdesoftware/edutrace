-- CreateTable
CREATE TABLE "CommentEdits" (
    "id" SERIAL NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_comment" INTEGER NOT NULL,
    CONSTRAINT "CommentEdits_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "CommentEdits_id_comment_idx" ON "CommentEdits"("id_comment");
-- AddForeignKey
ALTER TABLE "CommentEdits" ADD CONSTRAINT "CommentEdits_id_comment_fkey" FOREIGN KEY ("id_comment") REFERENCES "Comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
