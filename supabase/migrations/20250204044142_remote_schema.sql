alter table "public"."library_items" add column "avg_sentiment_confidence" numeric;

alter table "public"."library_items" add column "features" text[];

alter table "public"."library_items" add column "sentiment_tones" text[];


