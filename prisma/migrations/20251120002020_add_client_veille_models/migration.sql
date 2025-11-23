-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "veilleId" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "size" TEXT,
    "description" TEXT,
    "email" TEXT NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Veille" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "schedule" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Veille_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Veille" ADD CONSTRAINT "Veille_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_veilleId_fkey" FOREIGN KEY ("veilleId") REFERENCES "Veille"("id") ON DELETE SET NULL ON UPDATE CASCADE;
