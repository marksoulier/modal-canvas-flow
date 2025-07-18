import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Plan {
    id: string;
    plan_data: string; //jsonb
}

interface UserData {
    plan_type: 'free' | 'premium';
    subscription_date: string | null;
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
                .select('plan_type, subscription_date')
                .eq('user_id', userId)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error fetching profile:', profileError);
                return;
            }

            const { data: plans, error: plansError } = await supabase
                .from('user_plans')
                .select('id, plan_data')
                .eq('user_id', userId);

            if (plansError) {
                console.error('Error fetching plans:', plansError);
                return;
            }

            setUserData({
                plan_type: profile?.plan_type || 'free',
                subscription_date: profile?.subscription_date || null,
                plans: plans || []
            });
        } catch (error) {
            console.error('Error in fetchUserData:', error);
        }
    };

    // Initialize auth state
    useEffect(() => {
        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setUser(session?.user ?? null);
                
                if (session?.user) {
                    await fetchUserData(session.user.id);
                } else {
                    setUserData(null);
                }
                
                setIsLoading(false);
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

    const value = {
        user,
        userData,
        isLoading,
        isPremium: userData?.plan_type === 'premium',
        signIn,
        signUp,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
} 