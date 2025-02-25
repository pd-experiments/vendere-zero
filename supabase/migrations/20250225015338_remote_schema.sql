create table "public"."markets_overview" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid default gen_random_uuid(),
    "insights" jsonb
);


alter table "public"."markets_overview" enable row level security;

CREATE UNIQUE INDEX markets_overview_pkey ON public.markets_overview USING btree (id);

alter table "public"."markets_overview" add constraint "markets_overview_pkey" PRIMARY KEY using index "markets_overview_pkey";

alter table "public"."markets_overview" add constraint "markets_overview_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."markets_overview" validate constraint "markets_overview_user_id_fkey";

grant delete on table "public"."markets_overview" to "anon";

grant insert on table "public"."markets_overview" to "anon";

grant references on table "public"."markets_overview" to "anon";

grant select on table "public"."markets_overview" to "anon";

grant trigger on table "public"."markets_overview" to "anon";

grant truncate on table "public"."markets_overview" to "anon";

grant update on table "public"."markets_overview" to "anon";

grant delete on table "public"."markets_overview" to "authenticated";

grant insert on table "public"."markets_overview" to "authenticated";

grant references on table "public"."markets_overview" to "authenticated";

grant select on table "public"."markets_overview" to "authenticated";

grant trigger on table "public"."markets_overview" to "authenticated";

grant truncate on table "public"."markets_overview" to "authenticated";

grant update on table "public"."markets_overview" to "authenticated";

grant delete on table "public"."markets_overview" to "service_role";

grant insert on table "public"."markets_overview" to "service_role";

grant references on table "public"."markets_overview" to "service_role";

grant select on table "public"."markets_overview" to "service_role";

grant trigger on table "public"."markets_overview" to "service_role";

grant truncate on table "public"."markets_overview" to "service_role";

grant update on table "public"."markets_overview" to "service_role";


create schema if not exists "vecs";

create table "vecs"."base_demo" (
    "id" character varying not null,
    "vec" vector(1536) not null,
    "metadata" jsonb not null default '{}'::jsonb
);


create table "vecs"."company_knowledge" (
    "id" character varying not null,
    "vec" vector(1536) not null,
    "metadata" jsonb not null default '{}'::jsonb
);


create table "vecs"."library_items" (
    "id" character varying not null,
    "vec" vector(1536) not null,
    "metadata" jsonb not null default '{}'::jsonb
);


create table "vecs"."market_research" (
    "id" character varying not null,
    "vec" vector(1536) not null,
    "metadata" jsonb not null default '{}'::jsonb
);


create table "vecs"."shared_vectors" (
    "id" character varying not null,
    "vec" vector(1536) not null,
    "metadata" jsonb not null default '{}'::jsonb
);


create table "vecs"."variant_research" (
    "id" character varying not null,
    "vec" vector(1536) not null,
    "metadata" jsonb not null default '{}'::jsonb
);


CREATE UNIQUE INDEX base_demo_pkey ON vecs.base_demo USING btree (id);

CREATE UNIQUE INDEX company_knowledge_pkey ON vecs.company_knowledge USING btree (id);

CREATE UNIQUE INDEX library_items_pkey ON vecs.library_items USING btree (id);

CREATE UNIQUE INDEX market_research_pkey ON vecs.market_research USING btree (id);

CREATE UNIQUE INDEX shared_vectors_pkey ON vecs.shared_vectors USING btree (id);

CREATE UNIQUE INDEX variant_research_pkey ON vecs.variant_research USING btree (id);

alter table "vecs"."base_demo" add constraint "base_demo_pkey" PRIMARY KEY using index "base_demo_pkey";

alter table "vecs"."company_knowledge" add constraint "company_knowledge_pkey" PRIMARY KEY using index "company_knowledge_pkey";

alter table "vecs"."library_items" add constraint "library_items_pkey" PRIMARY KEY using index "library_items_pkey";

alter table "vecs"."market_research" add constraint "market_research_pkey" PRIMARY KEY using index "market_research_pkey";

alter table "vecs"."shared_vectors" add constraint "shared_vectors_pkey" PRIMARY KEY using index "shared_vectors_pkey";

alter table "vecs"."variant_research" add constraint "variant_research_pkey" PRIMARY KEY using index "variant_research_pkey";


