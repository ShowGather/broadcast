-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "settings" JSONB,
    "nextRevision" INTEGER NOT NULL DEFAULT 0,
    "publishedRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rundown" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rundown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RundownCue" (
    "id" TEXT NOT NULL,
    "rundownId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "commandPayload" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RundownCue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationSnapshot" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "productionId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresentationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationCommand" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "executionId" TEXT,
    "channelId" TEXT NOT NULL,
    "productionId" TEXT,
    "revision" INTEGER,
    "commandType" TEXT NOT NULL,
    "commandPayload" JSONB NOT NULL,
    "event" JSONB NOT NULL,
    "targetPts" DOUBLE PRECISION,
    "transport" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "dispatchError" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),

    CONSTRAINT "PresentationCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationOutbox" (
    "id" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "event" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "injectorAcceptedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresentationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RundownExecutionSession" (
    "id" TEXT NOT NULL,
    "rundownId" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RundownExecutionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RundownCueExecution" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rundownCueId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" INTEGER,
    "executedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RundownCueExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "Channel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_organisationId_slug_key" ON "Channel"("organisationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RundownCue_rundownId_position_key" ON "RundownCue"("rundownId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationSnapshot_channelId_key" ON "PresentationSnapshot"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationSnapshot_productionId_key" ON "PresentationSnapshot"("productionId");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationCommand_eventId_key" ON "PresentationCommand"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationCommand_executionId_key" ON "PresentationCommand"("executionId");

-- CreateIndex
CREATE INDEX "PresentationCommand_channelId_revision_idx" ON "PresentationCommand"("channelId", "revision");

-- CreateIndex
CREATE INDEX "PresentationCommand_channelId_status_idx" ON "PresentationCommand"("channelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationOutbox_commandId_key" ON "PresentationOutbox"("commandId");

-- CreateIndex
CREATE INDEX "PresentationOutbox_channelId_status_revision_idx" ON "PresentationOutbox"("channelId", "status", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationOutbox_channelId_revision_key" ON "PresentationOutbox"("channelId", "revision");

-- CreateIndex
CREATE INDEX "RundownExecutionSession_rundownId_mode_status_idx" ON "RundownExecutionSession"("rundownId", "mode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RundownCueExecution_executionId_key" ON "RundownCueExecution"("executionId");

-- CreateIndex
CREATE INDEX "RundownCueExecution_sessionId_rundownCueId_idx" ON "RundownCueExecution"("sessionId", "rundownCueId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rundown" ADD CONSTRAINT "Rundown_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RundownCue" ADD CONSTRAINT "RundownCue_rundownId_fkey" FOREIGN KEY ("rundownId") REFERENCES "Rundown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationSnapshot" ADD CONSTRAINT "PresentationSnapshot_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationSnapshot" ADD CONSTRAINT "PresentationSnapshot_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationCommand" ADD CONSTRAINT "PresentationCommand_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationCommand" ADD CONSTRAINT "PresentationCommand_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationOutbox" ADD CONSTRAINT "PresentationOutbox_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "PresentationCommand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationOutbox" ADD CONSTRAINT "PresentationOutbox_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RundownExecutionSession" ADD CONSTRAINT "RundownExecutionSession_rundownId_fkey" FOREIGN KEY ("rundownId") REFERENCES "Rundown"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RundownExecutionSession" ADD CONSTRAINT "RundownExecutionSession_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RundownCueExecution" ADD CONSTRAINT "RundownCueExecution_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RundownExecutionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RundownCueExecution" ADD CONSTRAINT "RundownCueExecution_rundownCueId_fkey" FOREIGN KEY ("rundownCueId") REFERENCES "RundownCue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
