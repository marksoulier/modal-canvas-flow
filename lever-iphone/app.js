import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { createClient } from "@supabase/supabase-js";

// 🔑 Replace with your Supabase project details
const supabaseUrl = "https://apxkjjrretikisblkdnw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFweGtqanJyZXRpa2lzYmxrZG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NzU5NTQsImV4cCI6MjA2ODQ1MTk1NH0.HJWgkxyjIi3JW9iVMalWGQ6RNsddQKwMJ2k372aJKOk";

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
    const [session, setSession] = useState(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [planData, setPlanData] = useState(null);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            // Auto-load plan when session is available
            if (session) {
                loadPlan();
            }
        });

        // Listen for changes (sign in / sign out)
        const { data: subscription } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                // Auto-load plan when user signs in
                if (session) {
                    loadPlan();
                } else {
                    setPlanData(null);
                }
            }
        );

        return () => subscription.subscription.unsubscribe();
    }, []);

    // Auto-load plan when session is available
    useEffect(() => {
        if (session && !planData) {
            loadPlan();
        }
    }, [session, planData]);

    async function signIn() {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
    }

    async function signOut() {
        await supabase.auth.signOut();
        setPlanData(null);
    }

    async function loadPlan() {
        if (!session) return;

        const userId = session.user.id;

        // Fetch first plan for the logged-in user
        const { data, error } = await supabase
            .from("plans")
            .select("current_balances, plan_name")
            .eq("user_id", userId)
            .limit(1);

        if (error) {
            alert(error.message);
            return;
        }

        if (data && data.length > 0 && data[0].current_balances) {
            try {
                // Parse JSONB into JS object
                const parsed = typeof data[0].current_balances === "string"
                    ? JSON.parse(data[0].current_balances)
                    : data[0].current_balances;

                setPlanData(parsed);
            } catch (err) {
                alert("Failed to parse current balances: " + err.message);
            }
        } else {
            alert("No current balances found for this user.");
        }
    }

    if (!session) {
        return (
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Financial Planner</Text>
                <Text style={styles.welcomeText}>Sign in to access your financial plans</Text>

                <View style={{ width: '100%', maxWidth: 400 }}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <TouchableOpacity style={styles.button} onPress={signIn}>
                        <Text style={styles.buttonText}>Sign In</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    }

    // Calculate net worth from enhanced data structure
    const calculateNetWorth = () => {
        if (!planData) return 0;
        return Object.values(planData).reduce((sum, account) => {
            // Only include networth accounts in net worth calculation
            return account.isNonNetworth ? sum : sum + account.value;
        }, 0);
    };

    // Group accounts by category
    const groupAccountsByCategory = () => {
        if (!planData) return {};

        const grouped = {};
        Object.entries(planData).forEach(([key, account]) => {
            const category = account.category;
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push({ key, ...account });
        });

        // Calculate subtotals for each category
        Object.keys(grouped).forEach(category => {
            const subtotal = grouped[category].reduce((sum, account) => sum + account.value, 0);
            grouped[category].subtotal = subtotal;
        });

        return grouped;
    };

    const netWorth = calculateNetWorth();
    const groupedAccounts = groupAccountsByCategory();

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {planData && (
                <>
                    {/* Net Worth Summary */}
                    <Text style={[
                        styles.netWorthText,
                        { color: netWorth >= 0 ? '#1a1a1a' : '#dc2626' }
                    ]}>
                        Net Worth: ${netWorth.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}
                    </Text>

                    {/* Account Categories */}
                    <View style={styles.accountsContainer}>
                        {Object.entries(groupedAccounts)
                            .filter(([category, accounts]) =>
                                category !== 'subtotal' &&
                                accounts.length > 0 &&
                                accounts.some(account => !account.isNonNetworth)
                            )
                            .map(([category, accounts]) => (
                                <View key={category} style={styles.categorySection}>
                                    {/* Category Header */}
                                    <Text style={styles.categoryTitle}>{category}</Text>

                                    {/* Account Cards - Only show networth accounts */}
                                    {accounts
                                        .filter(account =>
                                            !account.isNonNetworth &&
                                            Math.abs(account.value) > 0.01
                                        )
                                        .map((account) => (
                                            <View key={account.key} style={styles.accountCard}>
                                                <View style={styles.accountInfo}>
                                                    <View style={styles.accountHeader}>
                                                        <View style={[
                                                            styles.colorDot,
                                                            { backgroundColor: account.color.line }
                                                        ]} />
                                                        <Text style={styles.accountName}>{account.displayName}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.accountBalance}>
                                                    <Text style={[
                                                        styles.balanceAmount,
                                                        { color: account.value >= 0 ? '#000000' : '#dc2626' }
                                                    ]}>
                                                        ${Math.abs(account.value).toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        })}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                </View>
                            ))}
                    </View>
                </>
            )}

            <TouchableOpacity style={styles.buttonSecondary} onPress={signOut}>
                <Text style={styles.buttonSecondaryText}>Sign Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    input: {
        width: "100%",
        padding: 12,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        backgroundColor: 'white',
        fontSize: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
        color: '#111827',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 16,
        color: '#374151',
    },
    dataBox: {
        marginTop: 24,
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 12,
        width: "100%",
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    dataItem: {
        fontSize: 14,
        marginVertical: 4,
        color: '#6b7280',
        fontFamily: 'monospace',
    },
    balanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    balanceTitle: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
        marginRight: 12,
        color: '#374151',
    },
    balanceAmount: {
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'right',
    },
    button: {
        backgroundColor: '#03c6fc',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginVertical: 8,
        shadowColor: '#03c6fc',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    buttonSecondary: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginVertical: 8,
    },
    buttonSecondaryText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 20,
        color: '#111827',
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        color: '#111827',
    },
    netWorthCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        alignItems: 'center',
    },
    netWorthLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#64748b',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    netWorthText: {
        fontSize: 22,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 40,
        marginBottom: 20,
        color: '#1a1a1a',
        letterSpacing: 0.5,
    },
    accountsContainer: {
        width: '100%',
        gap: 12,
    },
    categorySection: {
        marginBottom: 16,
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#4a4a4a',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    accountCard: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 16,
        marginBottom: 6,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#e8e8e8',
    },
    accountInfo: {
        flex: 1,
        marginRight: 12,
    },
    accountHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    colorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    accountName: {
        fontSize: 15,
        fontWeight: '400',
        color: '#2a2a2a',
        flex: 1,
        letterSpacing: 0.2,
    },
    accountBalance: {
        alignItems: 'flex-end',
    },
    balanceAmount: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'right',
        letterSpacing: 0.3,
    },
});
