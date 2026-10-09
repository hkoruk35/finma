-- Admin rolleri: "engine" eklendi — yalnızca SPY / QQQ Engine sayfalarına ve API'lerine erişebilir
-- (proxy.ts + lib/apiAuth.ts isEngineAuthed). Mevcut kayıtlar etkilenmez; kısıt yalnızca genişler.

alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins
  add constraint admins_role_check check (role in ('admin','readonly','engine'));
