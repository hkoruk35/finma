-- Stripe faturalama: kart zorunlu 7 gün deneme, ilk ay $19, sonra $39/ay.
-- members.plan mantığı korunur; abonelik durumu artık Stripe webhook'ları ile senkronize edilir.

-- Artık trial, kayıt anında değil Stripe Checkout tamamlanınca (webhook) başlar;
-- kayıt sonrası "pending" durumda trial_ends_at henüz bilinmediği için nullable olmalı.
alter table public.members alter column trial_ends_at drop not null;
alter table public.members alter column trial_ends_at drop default;

alter table public.members
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column subscription_status text,
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false,
  add column consent_accepted_at timestamptz,
  add column consent_locale text;

create index members_stripe_customer_id_idx on public.members (stripe_customer_id);
create index members_stripe_subscription_id_idx on public.members (stripe_subscription_id);

alter table public.plans
  add column stripe_product_id text,
  add column stripe_price_id text,
  add column stripe_coupon_id text;
