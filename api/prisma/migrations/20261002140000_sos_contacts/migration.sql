-- CreateTable
CREATE TABLE "SosContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "visibleToAll" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SosContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosContactAssignment" (
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SosContactAssignment_pkey" PRIMARY KEY ("contactId","userId")
);

-- CreateIndex
CREATE INDEX "SosContact_active_sortOrder_idx" ON "SosContact"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "SosContactAssignment_userId_idx" ON "SosContactAssignment"("userId");

-- AddForeignKey
ALTER TABLE "SosContactAssignment" ADD CONSTRAINT "SosContactAssignment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SosContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosContactAssignment" ADD CONSTRAINT "SosContactAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
