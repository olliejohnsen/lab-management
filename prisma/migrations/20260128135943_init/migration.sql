-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DockerHost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "credentials" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ComposeFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComposeFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "composeFileId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "deployedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "Deployment_composeFileId_fkey" FOREIGN KEY ("composeFileId") REFERENCES "ComposeFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deployment_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "DockerHost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HostMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "cpuUsage" REAL NOT NULL,
    "ramUsage" REAL NOT NULL,
    "diskUsage" REAL NOT NULL,
    "networkPorts" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HostMetrics_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "DockerHost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "HostMetrics_hostId_timestamp_idx" ON "HostMetrics"("hostId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");
