-- Free tier Copilot kotasına token bazlı bir tavan ekler (15k token/gün),
-- mevcut sorgu-sayısı tavanının (user_credits.current_usage, bkz. 0015) yanına.
-- get_copilot_credit_status'un dönüş tipi değiştiği için önce DROP gerekiyor
-- (create or replace function dönüş tipini değiştiremiyor).

alter table public.user_credits
  add column tokens_used_today int not null default 0;

drop function if exists public.get_copilot_credit_status(uuid, int);

create or replace function public.get_copilot_credit_status(p_user_id uuid, p_default_limit int)
returns table(current_usage int, daily_limit int, tokens_used_today int)
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  insert into public.user_credits (user_id, daily_limit, current_usage, tokens_used_today, last_reset_date)
  values (p_user_id, p_default_limit, 0, 0, v_today)
  on conflict (user_id) do nothing;

  update public.user_credits
    set current_usage = 0, tokens_used_today = 0, last_reset_date = v_today, updated_at = now()
    where user_id = p_user_id and last_reset_date <> v_today;

  return query
    select uc.current_usage, uc.daily_limit, uc.tokens_used_today
    from public.user_credits uc
    where uc.user_id = p_user_id;
end;
$$;

-- ── Token artırımı — increment_copilot_credit ile aynı anda, başarılı yanıt
-- sonrası (onFinish) çağrılır. streamText'in usage.totalTokens'ı iletilir.
create or replace function public.increment_copilot_tokens(p_user_id uuid, p_tokens int)
returns int
language plpgsql security definer set search_path = public as $$
declare v_tokens int;
begin
  update public.user_credits
    set tokens_used_today = tokens_used_today + greatest(p_tokens, 0), updated_at = now()
    where user_id = p_user_id
    returning tokens_used_today into v_tokens;
  return v_tokens;
end;
$$;
