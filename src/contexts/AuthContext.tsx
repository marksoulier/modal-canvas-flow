import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
        console.log('AuthContext: Fetching user data for ID:', userId);
        try {
            // First try to get existing user data
            const { data, error } = await supabase.from('user_data').select('*').eq('user_id', userId);

            if (error) {
                // If no data exists, create it
                if (error.code === 'PGRST116') {
                    console.log('AuthContext: No user data found, creating new entry');
                    const { error: insertError } = await supabase
                        .from('user_data')
                        .insert({
                            user_id: userId,
                            plan_type: 'free',
                            subscription_date: null
                        });

                    if (insertError) {
                        console.error('AuthContext: Error creating user data:', insertError);
                        throw insertError;
                    }

                    console.log('AuthContext: Created new user data entry');
                    setUserData({ plan_type: 'free', subscription_date: null });
                    return;
                }
                throw error;
            }

            console.log('AuthContext: Found existing user data:', data);
            setUserData(data);
        } catch (error) {
            console.error('AuthContext: Error in fetchUserData:', error);
            setUserData(null);
        }
    };

    const signIn = async (email: string, password: string) => {
        console.log('AuthContext: Starting sign in process');
        setIsLoading(true);
        try {
            console.log('AuthContext: Calling Supabase sign in');
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('AuthContext: Sign in error:', error);
                throw error;
            }

            if (!data?.user?.id) {
                console.error('AuthContext: No user data in response');
                throw new Error('No user data received');
            }

            console.log('AuthContext: Sign in successful, user ID:', data.user.id);
            await fetchUserData(data.user.id);
            console.log('AuthContext: User data fetched successfully');
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