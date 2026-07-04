-- CreateEnum
CREATE TYPE "PetListingType" AS ENUM ('LOST', 'FOUND', 'DONATION');

-- CreateEnum
CREATE TYPE "PetListingStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "pet_listings" (
    "id" TEXT NOT NULL,
    "type" "PetListingType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "city" TEXT NOT NULL,
    "status" "PetListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pet_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_photos" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_listings_ownerId_idx" ON "pet_listings"("ownerId");

-- CreateIndex
CREATE INDEX "pet_photos_listingId_idx" ON "pet_photos"("listingId");

-- AddForeignKey
ALTER TABLE "pet_listings" ADD CONSTRAINT "pet_listings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_photos" ADD CONSTRAINT "pet_photos_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "pet_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
