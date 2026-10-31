create table if not exists vendors (
  id serial primary key, name text not null, domain text not null unique, owner text not null,
  status text not null default 'new', risk text null, next_review date null, created_at timestamptz not null default now()
);
create table if not exists assessments (
  id serial primary key, vendor_id int not null references vendors, created_at timestamptz not null default now(),
  questionnaire_name text not null, report_name text not null, pages jsonb not null,
  review_model text null, review_error text null, draft text null, draft_model text null, draft_approved_at timestamptz null
);
create table if not exists checks (
  id serial primary key, assessment_id int not null references assessments, kind text not null, ok boolean null,
  value text not null, raw text not null, error text null, ms int not null
);
create table if not exists findings (
  id serial primary key, assessment_id int not null references assessments, qid text not null, section text not null,
  question text not null, answer text not null, verdict text null, confidence real null, source text null,
  page int null, evidence text null, status text not null default 'open'
);
create table if not exists decisions (
  id serial primary key, assessment_id int not null unique references assessments, risk_score real not null,
  risk_probs jsonb not null, action text not null, action_probs jsonb not null, misrepresented real not null,
  model text not null, analyst_action text null, reason text null, decided_at timestamptz null
);
create table if not exists events (
  id serial primary key, vendor_id int not null references vendors, assessment_id int null,
  at timestamptz not null default now(), actor text not null, action text not null, detail text not null
);
