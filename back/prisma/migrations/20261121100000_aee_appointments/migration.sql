-- CreateTable
CREATE TABLE "AeeAppointment" (
    "id" SERIAL NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "id_teacher" INTEGER NOT NULL,
    "id_student" INTEGER NOT NULL,

    CONSTRAINT "AeeAppointment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AeeAppointment_period_check" CHECK ("ends_at" > "starts_at")
);

-- CreateIndex
CREATE INDEX "AeeAppointment_id_teacher_starts_at_idx" ON "AeeAppointment"("id_teacher", "starts_at");

-- CreateIndex
CREATE INDEX "AeeAppointment_id_student_idx" ON "AeeAppointment"("id_student");

-- AddForeignKey
ALTER TABLE "AeeAppointment" ADD CONSTRAINT "AeeAppointment_id_teacher_fkey" FOREIGN KEY ("id_teacher") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeeAppointment" ADD CONSTRAINT "AeeAppointment_id_student_fkey" FOREIGN KEY ("id_student") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
