-- "starter" hiçbir zaman gerçek bir paket değildi — members.plan kolonunun eski (Stripe öncesi)
-- varsayılan değeriydi. Gerçek paketler yalnızca "free_trial" (Free Trial) ve "premium" (Premium).
-- Yeni kayıtlar artık varsayılan olarak free_trial ile başlasın (register route zaten plan'ı
-- explicit 'pending' set ediyor, bu sadece trigger/varsayılan yol için güvenlik amaçlı).

alter table public.members alter column plan set default 'free_trial';

update public.members set plan = 'free_trial' where plan = 'starter';
