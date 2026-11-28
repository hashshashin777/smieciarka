-- Expose only the aggregate, never account records.
create or replace function public.get_registered_account_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from auth.users
  where is_anonymous is not true and deleted_at is null;
$$;

revoke all on function public.get_registered_account_count() from public;
grant execute on function public.get_registered_account_count() to anon, authenticated;
