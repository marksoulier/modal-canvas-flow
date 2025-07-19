import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Plan {
  id: string;
  plan_name: string;
  plan_data: any;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  plan_type: 'free' | 'premium';
  subscription_date: string | null;
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  togglePremium: () => Promise<void>;
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
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (profileError) throw profileError;

            const { data: plans, error: plansError } = await supabase
                .from('plans')
                .select('*')
                .eq('user_id', userId);

            if (plansError) throw plansError;

            setUserData({
                profile: profile || null,
                plans: plans || [],
            });
        } catch (error) {
            console.error('Error fetching user data:', error);
            // Create profile if it doesn't exist
            if (error.code === 'PGRST116') {
                try {
                    const { error: insertError } = await supabase
                        .from('user_profiles')
                        .insert({ user_id: userId, plan_type: 'free' });
                    
                    if (!insertError) {
                        // Retry fetching after creating profile
                        fetchUserData(userId);
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
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
    };

    const signUp = async (email: string, password: string) => {
        const redirectUrl = `${window.location.origin}/modal-canvas-flow/`;
        
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: redirectUrl
            }
        });
        
        if (error) throw error;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
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

    const value = {
        user,
        userData,
        isLoading,
        isPremium,
        signIn,
        signUp,
        signOut,
        togglePremium,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}