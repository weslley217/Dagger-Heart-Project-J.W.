CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Character" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "ownerId" TEXT,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "shortDescription" TEXT NOT NULL,
  "classKey" TEXT NOT NULL,
  "subclassKey" TEXT NOT NULL,
  "ancestryKey" TEXT NOT NULL,
  "communityKey" TEXT NOT NULL,
  "domains" TEXT NOT NULL DEFAULT '[]',
  "attributes" TEXT NOT NULL DEFAULT '{}',
  "proficiencies" TEXT NOT NULL DEFAULT '{}',
  "conditions" TEXT NOT NULL DEFAULT '[]',
  "resources" TEXT NOT NULL DEFAULT '{}',
  "totalHp" INTEGER NOT NULL,
  "currentHp" INTEGER NOT NULL DEFAULT 0,
  "armorMax" INTEGER NOT NULL,
  "armorCurrent" INTEGER NOT NULL,
  "threshold1" INTEGER NOT NULL,
  "threshold2" INTEGER NOT NULL,
  "evasion" INTEGER NOT NULL,
  "notes" TEXT,
  "isDowned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Character_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Card" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" TEXT,
  "classKey" TEXT,
  "subclassKey" TEXT,
  "domainKey" TEXT,
  "tier" TEXT,
  "text" TEXT NOT NULL,
  "keywords" TEXT NOT NULL DEFAULT '[]',
  "imageUrl" TEXT,
  "sourcePdfKey" TEXT,
  "sourcePage" INTEGER,
  "effects" TEXT NOT NULL DEFAULT '[]',
  "customHandler" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "CharacterCard" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'passiva',
  "usesMax" INTEGER,
  "usesCurrent" INTEGER,
  "cooldown" TEXT,
  "notes" TEXT,
  "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterCard_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CharacterCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DamageLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT NOT NULL,
  "damageRaw" INTEGER NOT NULL,
  "damagePoints" INTEGER NOT NULL,
  "armorUsed" BOOLEAN NOT NULL,
  "armorBefore" INTEGER NOT NULL,
  "armorAfter" INTEGER NOT NULL,
  "hpBefore" INTEGER NOT NULL,
  "hpAfter" INTEGER NOT NULL,
  "downed" BOOLEAN NOT NULL,
  "undoneAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DamageLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "EffectLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "characterId" TEXT,
  "cardId" TEXT,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EffectLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "EffectLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE INDEX IF NOT EXISTS "Character_campaignId_idx" ON "Character"("campaignId");
CREATE INDEX IF NOT EXISTS "Character_ownerId_idx" ON "Character"("ownerId");
CREATE INDEX IF NOT EXISTS "Card_category_idx" ON "Card"("category");
CREATE INDEX IF NOT EXISTS "Card_classKey_idx" ON "Card"("classKey");
CREATE INDEX IF NOT EXISTS "Card_subclassKey_idx" ON "Card"("subclassKey");
CREATE INDEX IF NOT EXISTS "Card_domainKey_idx" ON "Card"("domainKey");
CREATE INDEX IF NOT EXISTS "CharacterCard_characterId_idx" ON "CharacterCard"("characterId");
CREATE INDEX IF NOT EXISTS "CharacterCard_cardId_idx" ON "CharacterCard"("cardId");
CREATE UNIQUE INDEX IF NOT EXISTS "CharacterCard_characterId_cardId_key" ON "CharacterCard"("characterId", "cardId");
CREATE INDEX IF NOT EXISTS "DamageLog_characterId_idx" ON "DamageLog"("characterId");
CREATE INDEX IF NOT EXISTS "DamageLog_createdAt_idx" ON "DamageLog"("createdAt");
CREATE INDEX IF NOT EXISTS "EffectLog_characterId_idx" ON "EffectLog"("characterId");
CREATE INDEX IF NOT EXISTS "EffectLog_cardId_idx" ON "EffectLog"("cardId");
CREATE INDEX IF NOT EXISTS "EffectLog_createdAt_idx" ON "EffectLog"("createdAt");
