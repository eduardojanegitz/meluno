-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateEnum
CREATE TYPE "GroupCategory" AS ENUM ('TRIP', 'HOME', 'COUPLE', 'EVENT', 'FRIENDS', 'OTHER');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'PROVISIONAL', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('EMAIL', 'LINK');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FOOD', 'GROCERIES', 'TRANSPORT', 'HOUSING', 'UTILITIES', 'LEISURE', 'TRAVEL', 'EVENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "SplitMethod" AS ENUM ('EQUAL', 'EXACT', 'PERCENT', 'SHARES');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SettlementMethod" AS ENUM ('PIX', 'CASH', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('GROUP_CREATED', 'GROUP_UPDATED', 'GROUP_ARCHIVED', 'MEMBER_ADDED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_REMOVED', 'MEMBER_ROLE_CHANGED', 'INVITATION_SENT', 'INVITATION_REVOKED', 'EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED', 'EXPENSE_RESTORED', 'SETTLEMENT_CREATED', 'SETTLEMENT_CONFIRMED', 'SETTLEMENT_REJECTED', 'SETTLEMENT_DELETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EXPENSE_ADDED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED', 'INVITATION_RECEIVED', 'SETTLEMENT_RECEIVED', 'SETTLEMENT_CONFIRMATION_REQUESTED', 'SETTLEMENT_CONFIRMED', 'SETTLEMENT_REJECTED', 'MEMBER_JOINED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" TEXT NOT NULL,
    "defaultCurrency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "emailOnExpense" BOOLEAN NOT NULL DEFAULT false,
    "emailOnSettlement" BOOLEAN NOT NULL DEFAULT true,
    "emailOnInvitation" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "pix_key" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PixKeyType" NOT NULL,
    "value" VARCHAR(140) NOT NULL,
    "label" VARCHAR(40),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pix_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(280),
    "category" "GroupCategory" NOT NULL DEFAULT 'OTHER',
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "simplifyDebts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_member" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "userId" TEXT,
    "displayName" VARCHAR(60) NOT NULL,
    "email" VARCHAR(254),
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MemberStatus" NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_invitation" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "kind" "InvitationKind" NOT NULL,
    "email" VARCHAR(254),
    "targetMemberId" UUID,
    "tokenHash" CHAR(64) NOT NULL,
    "invitedByMemberId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "description" VARCHAR(120) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "splitMethod" "SplitMethod" NOT NULL,
    "notes" VARCHAR(1000),
    "receiptKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" VARCHAR(64),
    "createdByMemberId" UUID NOT NULL,
    "updatedByMemberId" UUID,
    "deletedByMemberId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_payer" (
    "expenseId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "expense_payer_pkey" PRIMARY KEY ("expenseId","memberId")
);

-- CreateTable
CREATE TABLE "expense_split" (
    "expenseId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "inputValue" INTEGER,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "expense_split_pkey" PRIMARY KEY ("expenseId","memberId")
);

-- CreateTable
CREATE TABLE "settlement" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "fromMemberId" UUID NOT NULL,
    "toMemberId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "date" DATE NOT NULL,
    "method" "SettlementMethod" NOT NULL DEFAULT 'PIX',
    "note" VARCHAR(280),
    "status" "SettlementStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" VARCHAR(64),
    "createdByMemberId" UUID NOT NULL,
    "decidedByMemberId" UUID,
    "decidedAt" TIMESTAMP(3),
    "deletedByMemberId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "actorMemberId" UUID,
    "type" "ActivityType" NOT NULL,
    "entityType" VARCHAR(32),
    "entityId" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "groupId" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit"("key");

-- CreateIndex
CREATE INDEX "pix_key_userId_idx" ON "pix_key"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "pix_key_userId_type_value_key" ON "pix_key"("userId", "type", "value");

-- CreateIndex
CREATE INDEX "group_member_userId_idx" ON "group_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "group_member_groupId_userId_key" ON "group_member"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "group_member_groupId_email_key" ON "group_member"("groupId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "group_invitation_tokenHash_key" ON "group_invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "group_invitation_groupId_idx" ON "group_invitation"("groupId");

-- CreateIndex
CREATE INDEX "group_invitation_email_idx" ON "group_invitation"("email");

-- CreateIndex
CREATE INDEX "expense_groupId_deletedAt_date_idx" ON "expense"("groupId", "deletedAt", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "expense_createdByMemberId_idempotencyKey_key" ON "expense"("createdByMemberId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "expense_payer_memberId_idx" ON "expense_payer"("memberId");

-- CreateIndex
CREATE INDEX "expense_split_memberId_idx" ON "expense_split"("memberId");

-- CreateIndex
CREATE INDEX "settlement_groupId_deletedAt_status_idx" ON "settlement"("groupId", "deletedAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_createdByMemberId_idempotencyKey_key" ON "settlement"("createdByMemberId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "activity_log_groupId_createdAt_idx" ON "activity_log"("groupId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_log_entityType_entityId_idx" ON "activity_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_key" ADD CONSTRAINT "pix_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invitation" ADD CONSTRAINT "group_invitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invitation" ADD CONSTRAINT "group_invitation_targetMemberId_fkey" FOREIGN KEY ("targetMemberId") REFERENCES "group_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invitation" ADD CONSTRAINT "group_invitation_invitedByMemberId_fkey" FOREIGN KEY ("invitedByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_updatedByMemberId_fkey" FOREIGN KEY ("updatedByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_deletedByMemberId_fkey" FOREIGN KEY ("deletedByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payer" ADD CONSTRAINT "expense_payer_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payer" ADD CONSTRAINT "expense_payer_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_split" ADD CONSTRAINT "expense_split_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_decidedByMemberId_fkey" FOREIGN KEY ("decidedByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_deletedByMemberId_fkey" FOREIGN KEY ("deletedByMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Integridade financeira (não modelável no Prisma) ───────────────────────
ALTER TABLE "expense"
  ADD CONSTRAINT "expense_amount_positive" CHECK ("amountMinor" > 0 AND "amountMinor" <= 1000000000),
  ADD CONSTRAINT "expense_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "expense_version_positive" CHECK ("version" >= 1);

ALTER TABLE "expense_payer"
  ADD CONSTRAINT "expense_payer_amount_positive" CHECK ("amountMinor" > 0);

-- Uma divisão pode ser 0 (ex.: R$ 0,01 dividido entre 3), nunca negativa.
ALTER TABLE "expense_split"
  ADD CONSTRAINT "expense_split_amount_non_negative" CHECK ("amountMinor" >= 0),
  ADD CONSTRAINT "expense_split_input_non_negative" CHECK ("inputValue" IS NULL OR "inputValue" >= 0);

ALTER TABLE "settlement"
  ADD CONSTRAINT "settlement_amount_positive" CHECK ("amountMinor" > 0 AND "amountMinor" <= 1000000000),
  ADD CONSTRAINT "settlement_distinct_members" CHECK ("fromMemberId" <> "toMemberId"),
  ADD CONSTRAINT "settlement_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "group"
  ADD CONSTRAINT "group_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');

-- Membro provisório não tem usuário; membro ativo precisa ter.
ALTER TABLE "group_member"
  ADD CONSTRAINT "group_member_status_user" CHECK (
    ("status" = 'PROVISIONAL' AND "userId" IS NULL) OR ("status" = 'ACTIVE' AND "userId" IS NOT NULL) OR "status" IN ('LEFT', 'REMOVED')
  );

ALTER TABLE "group_invitation"
  ADD CONSTRAINT "group_invitation_email_kind" CHECK ("kind" = 'LINK' OR "email" IS NOT NULL),
  ADD CONSTRAINT "group_invitation_use_count" CHECK ("useCount" >= 0 AND ("maxUses" IS NULL OR "useCount" <= "maxUses"));
