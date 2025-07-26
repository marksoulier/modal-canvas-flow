import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import type { Plan as PlanContextPlan } from './PlanContext';
import type { TablesInsert } from '../integrations/supabase/types';

interface Plan {
    id: string;
    plan_name: string | null;
    plan_data: any;
    plan_image?: string | null;
    created_at: string;
    updated_at: string;
}

interface UserProfile {
    id: string;
    user_id: string;
    plan_type: 'free' | 'premium';
    subscription_date: string | null;
    subscription_status?: 'active' | 'canceled' | 'ended';
    subscription_canceled_at?: string | null;
    subscription_ends_at?: string | null;
    stripe_subscription_id?: string | null;
    anonymous_anon?: string; // <-- add this
    created_at: string;
    updated_at: string;
}

interface UserData {
    profile: UserProfile | null;
    plans: Plan[];
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    isLoading: boolean;
    isPremium: boolean;
    signIn: (email: string, password: string) => Promise<any>;
    signUp: (email: string, password: string, profileData?: Partial<UserProfile>) => Promise<any>;
    signOut: () => Promise<void>;
    togglePremium: () => Promise<void>;
    refreshUserData: () => Promise<void>;
    savePlanToCloud: (plan: PlanContextPlan, planImage?: string) => Promise<{ success: boolean; requiresConfirmation?: boolean; existingPlanName?: string }>;
    confirmOverwritePlan: (plan: PlanContextPlan, planName: string, planImage?: string) => Promise<boolean>;
    deletePlan: (planId: string) => Promise<boolean>;
    loadPlanById: (planId: string) => Promise<Plan | null>;
    upsertAnonymousOnboarding: (onboardingData: any) => Promise<boolean>;
    fetchAnonymousOnboarding: () => Promise<any>;
    upsertAnonymousPlan: (planName: string, planData: any, planImage?: string) => Promise<boolean>;
    logAnonymousButtonClick: (buttonId: string) => Promise<boolean>;
    fetchDefaultPlans: () => Promise<{ plan_name: string | null; plan_data: any; plan_image: string | null }[]>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Utility to get or create anon_id in localStorage
function getOrCreateAnonId() {
    let anonId = localStorage.getItem('anon_id');
    if (!anonId) {
        anonId = crypto.randomUUID();
        localStorage.setItem('anon_id', anonId);
    }
    //console.log("anonId", anonId);
    return anonId;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch user data from database
    const fetchUserData = async (userId: string) => {
        try {
            console.log('🔄 Fetching3 user data for:', userId);
            // Add explicit user_id filter in addition to RLS for performance
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId) // Explicit filter for performance
                .single();

            if (profileError && (profileError as any).code !== 'PGRST116') {
                throw profileError;
            }

            const { data: plans, error: plansError } = await supabase
                .from('plans')
                .select('*')
                .eq('user_id', userId); // Explicit filter for performance

            if (plansError) throw plansError;

            setUserData({
                profile: profile ? {
                    ...profile,
                    plan_type: profile.plan_type as 'free' | 'premium'
                } : null,
                plans: plans || [],
            });

            //add anonId to the profile
            const anonId = getOrCreateAnonId();
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({ anonymous_anon: anonId })
                .eq('user_id', userId);
            if (updateError) throw updateError;

            // Create profile if it doesn't exist
            if (!profile || (profileError as any)?.code === 'PGRST116') {
                try {
                    console.log('🔄 Creating user profile for:', userId);
                    const anonId = getOrCreateAnonId();
                    console.log('🔄 Anon ID:', anonId);
                    const { error: insertError } = await supabase
                        .from('user_profiles')
                        .insert({ user_id: userId, plan_type: 'free', anonymous_anon: anonId });

                    if (!insertError) {
                        // Retry fetching after creating profile
                        setTimeout(() => fetchUserData(userId), 1000);
                    }
                } catch (insertError) {
                    console.error('Error creating user profile:', insertError);
                }
            }
        } catch (error: any) {
            console.error('Error fetching user data:', error);
        }
    };

    // Initialize auth state
    useEffect(() => {
        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(session?.user ?? null);
                setIsLoading(false);

                // Use setTimeout to avoid deadlock when calling other Supabase functions
                if (session?.user) {
                    setTimeout(async () => {
                        console.log('🔄 Fetching user data for:', session.user.id);
                        await fetchUserData(session.user.id);
                    }, 0);
                } else {
                    setUserData(null);
                }
            }
        );

        // Check for existing session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                console.log('🔄 Fetching2 user data for:', session.user.id);
                fetchUserData(session.user.id);
            } else {
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const isPremium = userData?.profile?.plan_type === 'premium';

    const signIn = async (email: string, password: string) => {
        console.log('🔑 Attempting sign in for:', email);

        // Clear any existing session first to prevent conflicts
        await supabase.auth.signOut();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('❌ Sign in failed:', error.message);
            throw error;
        }

        console.log('✅ Sign in successful:', data.user?.email);
        // After successful sign-in, fetch user data (and create profile if needed)
        if (data.user && data.user.id) {
            await fetchUserData(data.user.id);
        }
        return data;
    };

    const signUp = async (email: string, password: string, profileData?: Partial<UserProfile>) => {
        console.log('📝 Attempting sign up for:', email);

        // Clear any existing session first
        await supabase.auth.signOut();

        const redirectUrl = `${window.location.origin}/modal-canvas-flow/`;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: redirectUrl
            }
        });

        if (error) {
            console.error('❌ Sign up failed:', error.message);
            throw error;
        }

        console.log('✅ Sign up successful:', data.user?.email);
        // No profile creation here; it will be handled after sign-in
        return data;
    };

    const signOut = async () => {
        console.log('🚪 Signing out user:', user?.email);

        // Clear local state first
        setUser(null);
        setUserData(null);

        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('❌ Sign out failed:', error.message);
            throw error;
        }

        console.log('✅ Sign out successful');
    };



    const togglePremium = async () => {
        if (!user || !userData?.profile) return;

        const newPlanType = userData.profile.plan_type === 'free' ? 'premium' : 'free';
        const subscriptionDate = newPlanType === 'premium' ? new Date().toISOString() : null;

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({
                    plan_type: newPlanType,
                    subscription_date: subscriptionDate
                })
                .eq('user_id', user.id);

            if (error) throw error;

            // Update local state
            setUserData(prev => prev ? {
                ...prev,
                profile: prev.profile ? {
                    ...prev.profile,
                    plan_type: newPlanType,
                    subscription_date: subscriptionDate
                } : null
            } : null);
        } catch (error) {
            console.error('Error toggling premium status:', error);
            throw error;
        }
    };

    // Save plan to cloud with conflict detection
    const savePlanToCloud = async (plan: PlanContextPlan, planImage?: string): Promise<{ success: boolean; requiresConfirmation?: boolean; existingPlanName?: string }> => {
        if (!user || !plan) {
            toast.error('Unable to save: User not logged in or no plan data');
            return { success: false };
        }

        if (!plan.title || !plan.title.trim()) {
            toast.error('Please set a plan title before saving');
            return { success: false };
        }

        const planName = plan.title.trim();

        try {
            // Check if a plan with this name already exists for this user
            const { data: existingPlans, error: selectError } = await supabase
                .from('plans')
                .select('id, plan_name')
                .eq('user_id', user.id)
                .eq('plan_name', planName)
                .limit(1);

            if (selectError) {
                console.error('Error checking existing plans:', selectError);
                throw selectError;
            }

            // If plan exists, return confirmation required
            if (existingPlans && existingPlans.length > 0) {
                return {
                    success: false,
                    requiresConfirmation: true,
                    existingPlanName: planName
                };
            }

            // No conflict, save the plan
            const { error } = await supabase
                .from('plans')
                .insert({
                    user_id: user.id,
                    plan_name: planName,
                    plan_data: plan as any, // Type assertion for JSON compatibility
                    plan_image: planImage || null,
                });

            //Also save the plan to the anonymous_plans table
            const upsertData = {
                anonymous_user_id: getOrCreateAnonId(),
                plan_name: planName,
                plan_data: plan as any, // Type assertion for JSON compatibility
                plan_image: planImage || null,
            };
            const { error: anonymousError } = await supabase
                .from('anonymous_plans')
                .upsert(
                    upsertData,
                    { onConflict: 'anonymous_user_id,plan_name' }
                );


            if (error) {
                console.error('Error inserting plan:', error);
                throw error;
            }

            if (anonymousError) {
                console.error('Error inserting anonymous plan:', anonymousError);
                throw anonymousError;
            }

            toast.success(`Plan "${planName}" saved to cloud successfully!`);
            return { success: true };

        } catch (error: any) {
            console.error('Error saving to cloud:', error);

            // Handle specific timeout errors
            if (error?.message?.includes('timeout') || error?.code === 'PGRST301') {
                toast.error('Request timed out. Please try again.');
            } else {
                toast.error('Failed to save plan to cloud. Please try again.');
            }
            return { success: false };
        }
    };

    // Confirm and overwrite existing plan
    const confirmOverwritePlan = async (plan: PlanContextPlan, planName: string, planImage?: string): Promise<boolean> => {
        if (!user || !plan) {
            toast.error('Unable to save: User not logged in or no plan data');
            return false;
        }

        try {
            // Update the existing plan
            const { error } = await supabase
                .from('plans')
                .update({
                    plan_data: plan as any, // Type assertion for JSON compatibility
                    plan_image: planImage || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id)
                .eq('plan_name', planName);
            
            const upsertData = {
                anonymous_user_id: getOrCreateAnonId(),
                plan_name: planName,
                plan_data: plan as any, // Type assertion for JSON compatibility
                plan_image: planImage || null,
            };
            const { error: anonymousError } = await supabase
                .from('anonymous_plans')
                .upsert(
                    upsertData,
                    { onConflict: 'anonymous_user_id,plan_name' }
                );

            if (error) {
                console.error('Error updating plan:', error);
                throw error;
            }

            toast.success(`Plan "${planName}" updated successfully!`);
            return true;

        } catch (error: any) {
            console.error('Error updating plan:', error);

            // Handle specific timeout errors
            if (error?.message?.includes('timeout') || error?.code === 'PGRST301') {
                toast.error('Request timed out. Please try again.');
            } else {
                toast.error('Failed to update plan. Please try again.');
            }
            return false;
        }
    };

    const deletePlan = async (planId: string): Promise<boolean> => {
        if (!user) {
            toast.error('Unable to delete plan: User not logged in');
            return false;
        }

        try {
            const { error } = await supabase
                .from('plans')
                .delete()
                .eq('id', planId)
                .eq('user_id', user.id);

            if (error) {
                console.error('Error deleting plan:', error);
                throw error;
            }

            toast.success('Plan deleted successfully!');
            await fetchUserData(user.id); // Refresh user data to update the plans list
            return true;
        } catch (error: any) {
            console.error('Error deleting plan:', error);
            toast.error('Failed to delete plan. Please try again.');
            return false;
        }
    };

    const loadPlanById = async (planId: string): Promise<Plan | null> => {
        if (!user) {
            toast.error('Unable to load plan: User not logged in');
            return null;
        }

        try {
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .eq('id', planId)
                .eq('user_id', user.id)
                .single();

            if (error) {
                console.error('Error loading plan:', error);
                throw error;
            }

            return data;
        } catch (error: any) {
            console.error('Error loading plan:', error);
            toast.error('Failed to load plan. Please try again.');
            return null;
        }
    };

    const refreshUserData = async () => {
        if (user) {
            await fetchUserData(user.id);
        }
    };

    // Upsert onboarding data for anonymous user
    const upsertAnonymousOnboarding = async (onboardingData: any) => {
        const anonId = getOrCreateAnonId();
        //console.log("anonId", anonId);
        let extraData: Record<string, any> = {
            user_agent: navigator.userAgent,
            session_start: new Date().toISOString(),
            referrer: document.referrer,
            utm_source: new URLSearchParams(window.location.search).get('utm_source'),
            screen_width: window.screen.width,
            screen_height: window.screen.height,
            device_pixel_ratio: window.devicePixelRatio,
            browser_language: navigator.language,
        };
        // Fetch geolocation data from ipapi.co if in browser
        if (typeof window !== 'undefined') {
            try {
                // TODO: Replace 'YOUR_TOKEN' with your actual ipinfo.io token
                const geoRes = await fetch('https://ipinfo.io/json?token=0b68efa9e2d384');
                if (geoRes.ok) {
                    const geo = await geoRes.json();
                    extraData = {
                        ...extraData,
                        ip: geo.ip,
                        city: geo.city,
                        region: geo.region,
                        country: geo.country_name,
                        country_code: geo.country,
                        postal: geo.postal,
                        latitude: geo.latitude,
                        longitude: geo.longitude,
                        timezone: geo.timezone,
                        org: geo.org,
                    };
                }
            } catch (err) {
                // Ignore geolocation errors
                console.warn('Failed to fetch geolocation data', err);
            }
        }
        const { error } = await supabase
            .from('anonymous_users')
            .upsert({
                id: anonId,
                onboarding_data: onboardingData,
                extra_data: extraData, // Store all extra data
            });
        if (error) {
            console.error('Error upserting anonymous onboarding:', error);
            toast.error('Failed to save onboarding progress.');
            return false;
        }
        return true;
    };

    // Fetch onboarding data for current anon_id
    const fetchAnonymousOnboarding = async () => {
        const anonId = localStorage.getItem('anon_id');
        //console.log("anonId", anonId);
        if (!anonId) return null;
        const { data, error } = await supabase
            .from('anonymous_users')
            .select('onboarding_data, extra_data') // Select extra_data
            .eq('id', anonId)
            .single();
        if (error) {
            console.error('Error fetching anonymous onboarding:', error);
            return null;
        }
        return {
            onboarding_data: data?.onboarding_data ?? null,
            extra_data: data?.extra_data ?? null
        };
    };

    // Upsert a plan for the anonymous user
    const upsertAnonymousPlan = async (planName: string, planData: any, planImage?: string) => {
        const anonId = getOrCreateAnonId();
        const { error } = await supabase
            .from('anonymous_plans')
            .upsert(
                {
                    anonymous_user_id: anonId,
                    plan_name: planName,
                    plan_data: planData,
                    plan_image: planImage || null,
                },
                { onConflict: 'anonymous_user_id,plan_name' }
            );
        if (error) {
            console.error('Error upserting anonymous plan:', error);
            toast.error('Failed to save anonymous plan.');
            return false;
        }
        return true;
    };

    const logAnonymousButtonClick = async (buttonId: string) => {
        const anonId = getOrCreateAnonId();
        if (!anonId) return false;
        // Fetch current button_clicks
        const { data, error } = await supabase
            .from('anonymous_users')
            .select('button_clicks')
            .eq('id', anonId)
            .single();
        if (error) {
            console.error('Error fetching button_clicks:', error);
            return false;
        }
        let buttonClicks: Record<string, number> = {};
        if (data?.button_clicks && typeof data.button_clicks === 'object' && !Array.isArray(data.button_clicks)) {
            buttonClicks = { ...data.button_clicks } as Record<string, number>;
        }
        buttonClicks[buttonId] = (buttonClicks[buttonId] || 0) + 1;
        // Upsert updated button_clicks
        const { error: upsertError } = await supabase
            .from('anonymous_users')
            .update({ button_clicks: buttonClicks })
            .eq('id', anonId);
        if (upsertError) {
            console.error('Error upserting button_clicks:', upsertError);
            return false;
        }
        return true;
    };

    const fetchDefaultPlans = async () => {
        // Use a hardcoded anonymous key for default plans that everyone can access
        const defaultAnonId = '3bca4c8b-36ab-43fc-86b0-e572b14186fa';
        const { data, error } = await supabase
            .from('anonymous_plans')
            .select('plan_name, plan_data, plan_image')
            .eq('anonymous_user_id', defaultAnonId);
        if (error) {
            console.error('Error fetching default plans:', error);
            return [];
        }
        return data || [];
    };

    const value = {
        user,
        userData,
        isLoading,
        isPremium,
        signIn,
        signUp,
        signOut,
        togglePremium,
        refreshUserData,
        savePlanToCloud,
        confirmOverwritePlan,
        deletePlan,
        loadPlanById,
        upsertAnonymousOnboarding,
        fetchAnonymousOnboarding,
        upsertAnonymousPlan,
        logAnonymousButtonClick,
        fetchDefaultPlans,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}