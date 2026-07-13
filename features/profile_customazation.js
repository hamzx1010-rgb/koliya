-- notifications_and_streaks.sql
-- Run this in Supabase SQL editor (copy-paste)

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid,
  type text,
  payload jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);

-- Streaks table
CREATE TABLE IF NOT EXISTS public.streaks (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  current_streak integer DEFAULT 0,
  last_active_date date,
  best_streak integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- RPC to record daily activity
create or replace function public.record_daily_activity(p_user_id uuid)
returns table(current_streak int, best_streak int) as $$
declare
  s record;
  today date := current_date;
begin
  select * into s from public.streaks where user_id = p_user_id for update;
  if not found then
    insert into public.streaks(user_id, current_streak, last_active_date, best_streak) values (p_user_id, 1, today, 1);
    current_streak := 1; best_streak := 1;
    return next;
  end if;

  if s.last_active_date = today then
    current_streak := s.current_streak; best_streak := s.best_streak;
    return next;
  elsif s.last_active_date = today - 1 then
    update public.streaks set current_streak = s.current_streak + 1, last_active_date = today, best_streak = greatest(s.best_streak, s.current_streak + 1), updated_at = now() where user_id = p_user_id;
    select current_streak, best_streak into current_streak, best_streak from public.streaks where user_id = p_user_id;
    return next;
  else
    update public.streaks set current_streak = 1, last_active_date = today, updated_at = now() where user_id = p_user_id;
    select current_streak, best_streak into current_streak, best_streak from public.streaks where user_id = p_user_id;
    return next;
  end if;
end;
$$ language plpgsql security definer;
