-- Optimize RLS policies for better performance
-- This wraps auth.uid() in select statements to cache the result
-- and adds role restrictions to eliminate anonymous users

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can view their own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can insert their own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can update their own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can delete their own plans" ON public.plans;

-- Create optimized RLS policies for user_profiles
CREATE POLICY "Users can view their own profile" 
ON public.user_profiles 
FOR SELECT 
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.user_profiles 
FOR UPDATE 
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.user_profiles 
FOR INSERT 
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Create optimized RLS policies for plans
CREATE POLICY "Users can view their own plans" 
ON public.plans 
FOR SELECT 
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own plans" 
ON public.plans 
FOR INSERT 
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own plans" 
ON public.plans 
FOR UPDATE 
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own plans" 
ON public.plans 
FOR DELETE 
TO authenticated
USING ((SELECT auth.uid()) = user_id); 