import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface UserData {
    plan_type: 'free' | 'premium';
    subscription_date: string | null;
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

    // Fetch user data from Supabase
    const fetchUserData = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_data')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) throw error;

            if (data) {
                setUserData(data);
            } else {
                // If no user data exists, create it with free plan
                const { error: insertError } = await supabase
                    .from('user_data')
                    .insert({
                        user_id: userId,
                        plan_type: 'free',
                        subscription_date: null
                    });

                if (insertError) throw insertError;
                setUserData({ plan_type: 'free', subscription_date: null });
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            setUserData(null);
        }
    };

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserData(session.user.id);
            }
            setIsLoading(false);
        });

        // Listen for changes on auth state (sign in, sign out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchUserData(session.user.id);
            } else {
                setUserData(null);
            }
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        console.log('AuthContext: Starting sign in process');
        setIsLoading(true);
        try {
            console.log('AuthContext: Calling Supabase sign in');
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('AuthContext: Sign in error:', error);
                throw error;
            }

            // Get the current session after successful sign in
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                console.log('AuthContext: Session obtained, fetching user data');
                await fetchUserData(session.user.id);
            }
        } catch (error) {
            console.error('AuthContext: Error in sign in process:', error);
            throw error;
        } finally {
            console.log('AuthContext: Sign in process finished');
            setIsLoading(false);
        }
    };

    const signUp = async (email: string, password: string) => {
        console.log('AuthContext: Starting sign up process');
        setIsLoading(true);
        try {
            console.log('AuthContext: Calling Supabase sign up');
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                console.error('AuthContext: Sign up error:', error);
                throw error;
            }

            console.log('AuthContext: Sign up successful, fetching user data');
            await fetchUserData(data.user.id);
            console.log('AuthContext: User data fetched successfully');
        } catch (error) {
            console.error('AuthContext: Error in sign up process:', error);
            throw error;
        } finally {
            console.log('AuthContext: Sign up process finished');
            setIsLoading(false);
        }
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