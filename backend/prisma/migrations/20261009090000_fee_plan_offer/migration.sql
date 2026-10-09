-- Limited-time offer on a fee plan
ALTER TABLE "fee_plans" ADD COLUMN "offerPrice" DECIMAL(10,2),
ADD COLUMN "offerLabel" TEXT,
ADD COLUMN "offerEndsAt" TIMESTAMP(3);
