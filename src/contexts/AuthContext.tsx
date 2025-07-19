import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import type { Plan as PlanContextPlan } from './PlanContext';

interface Plan {
    id: string;
    plan_name: string | null;
    plan_data: any;
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
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    location?: string;
    education?: string;
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
    savePlanToCloud: (plan: PlanContextPlan) => Promise<{ success: boolean; requiresConfirmation?: boolean; existingPlanName?: string }>;
    confirmOverwritePlan: (plan: PlanContextPlan, planName: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch user data from database
    const fetchUserData = async (userId: string) => {
        try {
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

            // Create profile if it doesn't exist
            if (!profile || (profileError as any)?.code === 'PGRST116') {
                try {
                    const { error: insertError } = await supabase
                        .from('user_profiles')
                        .insert({ user_id: userId, plan_type: 'free' });

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

            // Handle specific timeout errors
            if (error?.message?.includes('timeout') || error?.code === 'PGRST301') {
                console.error('Database timeout - this suggests RLS performance issues');
                // Could trigger a retry or show user message
            }

            // Create profile if it doesn't exist (fallback)
            if (error?.code === 'PGRST116') {
                try {
                    const { error: insertError } = await supabase
                        .from('user_profiles')
                        .insert({ user_id: userId, plan_type: 'free' });

                    if (!insertError) {
                        // Retry fetching after creating profile
                        setTimeout(() => fetchUserData(userId), 1000);
                    }
                } catch (insertError) {
                    console.error('Error creating user profile:', insertError);
                }
            }
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

        // If user creation was successful and we have a user ID
        if (data.user && data.user.id) {
            // Create or update the user profile with additional data
            const { error: profileError } = await supabase
                .from('user_profiles')
                .upsert({
                    user_id: data.user.id,
                    first_name: profileData?.first_name,
                    last_name: profileData?.last_name,
                    birth_date: profileData?.birth_date,
                    location: profileData?.location,
                    education: profileData?.education,
                    plan_type: 'free'
                });

            if (profileError) {
                console.error('Error creating user profile:', profileError);
                // Don't throw here as the user account was created successfully
            }
        }

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
    const savePlanToCloud = async (plan: PlanContextPlan): Promise<{ success: boolean; requiresConfirmation?: boolean; existingPlanName?: string }> => {
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
                });

            if (error) {
                console.error('Error inserting plan:', error);
                throw error;
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
    const confirmOverwritePlan = async (plan: PlanContextPlan, planName: string): Promise<boolean> => {
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
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id)
                .eq('plan_name', planName);

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

    const refreshUserData = async () => {
        if (user) {
            await fetchUserData(user.id);
        }
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
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}