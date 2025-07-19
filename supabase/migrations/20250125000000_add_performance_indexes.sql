-- Add performance indexes for RLS policies
-- These indexes are CRITICAL for RLS performance when using auth.uid() = user_id

-- Index for user_profiles table
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
ON public.user_profiles USING btree (user_id);

-- Index for plans table  
CREATE INDEX IF NOT EXISTS idx_plans_user_id 
ON public.plans USING btree (user_id);

-- Optional: Add composite indexes if you frequently filter by other columns
-- CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_plan_type 
-- ON public.user_profiles USING btree (user_id, plan_type);

-- CREATE INDEX IF NOT EXISTS idx_plans_user_id_created_at 
-- ON public.plans USING btree (user_id, created_at DESC); 