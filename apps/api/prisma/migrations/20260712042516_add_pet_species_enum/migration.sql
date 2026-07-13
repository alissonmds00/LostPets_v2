-- CreateEnum
CREATE TYPE "PetSpecies" AS ENUM ('DOG', 'CAT', 'BIRD');

-- Normalize existing free-text species values (dev data) into the new
-- enum's values before the column type change below can cast them.
UPDATE "pet_listings" SET "species" = 'DOG' WHERE "species" ILIKE 'cachorro';
UPDATE "pet_listings" SET "species" = 'CAT' WHERE "species" ILIKE 'gato';
UPDATE "pet_listings" SET "species" = 'BIRD' WHERE "species" ILIKE 'pássaro' OR "species" ILIKE 'passaro';

-- AlterTable
ALTER TABLE "pet_listings" ALTER COLUMN "species" TYPE "PetSpecies" USING ("species"::"PetSpecies");
