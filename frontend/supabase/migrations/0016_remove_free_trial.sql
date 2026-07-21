-- Business model change: no more 7-day free trial — membership requires an
-- immediate paid subscription (first month may still be discounted via a
-- Stripe coupon, but there is no trial period). "free_trial" is no longer a
-- real membership state; existing members in that state are moved to
-- "pending" (same state a brand-new signup starts in — must complete
-- checkout to get access) rather than left in a plan the app no longer grants.

update public.members set plan = 'pending' where plan = 'free_trial';

alter table public.members alter column plan set default 'pending';

-- Deactivate the free_trial catalog row so it stops appearing as a
-- selectable plan in the admin panel — kept (not deleted) so historical
-- references/reports involving old free_trial members still resolve a name.
update public.plans set active = false where key = 'free_trial';
