-- AlterTable
ALTER TABLE "Production" ADD COLUMN     "configuration" JSONB,
ADD COLUMN     "showConfigurationId" TEXT;

-- AlterTable
ALTER TABLE "RundownExecutionSession" ADD COLUMN     "rundownSnapshot" JSONB;

-- CreateTable
CREATE TABLE "ShowConfiguration" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowConfiguration_channelId_name_key" ON "ShowConfiguration"("channelId", "name");

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_showConfigurationId_fkey" FOREIGN KEY ("showConfigurationId") REFERENCES "ShowConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowConfiguration" ADD CONSTRAINT "ShowConfiguration_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
