import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAuth } from '../contexts/AuthContext';
import { callSupabaseFunction, supabase } from '../integrations/supabase/client';
import { X, CreditCard, Building, RefreshCw, AlertCircle, Plus, CheckCircle, Banknote } from 'lucide-react';

interface PlaidDemoProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Account {
    account_id: string;
    name: string;
    type: string;
    subtype: string;
    balances: {
        current: number | null;
        available: number | null;
    };
    institution_name?: string;
}

const PlaidDemo: React.FC<PlaidDemoProps> = ({ isOpen, onClose }) => {
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState(false);

    const { user } = useAuth();

    // Get the auth token from Supabase session
    const getAuthToken = async () => {
        console.log('🔐 Getting auth token from Supabase session...');
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token;
    };

    // Get Link Token from Plaid (background process)
    const getLinkToken = async () => {
        if (!user) {
            setError('Please sign in to connect bank accounts');
            return null;
        }

        console.log('🔗 Generating Plaid Link token...');
        setError('');

        try {
            const authToken = await getAuthToken();
            const response = await callSupabaseFunction('create-link-token', {}, authToken);

            if (response.link_token) {
                console.log('✅ Link token generated successfully');
                setLinkToken(response.link_token);
                return response.link_token;
            } else {
                throw new Error(response.error || 'Failed to get link token');
            }
        } catch (err) {
            const errorMsg = 'Error getting link token: ' + (err as Error).message;
            console.error('❌', errorMsg);
            setError(errorMsg);
            return null;
        }
    };

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: async (public_token: string) => {
            console.log('🏦 Bank connection successful! Exchanging tokens...');
            setIsConnecting(true);
            setError('');

            try {
                const authToken = await getAuthToken();
                const data = await callSupabaseFunction('plaid-exchange-token', { public_token }, authToken);

                if (data.success) {
                    console.log('✅ Token exchange successful:', data.institution_name || 'Bank connected');
                    console.log('🔄 Refreshing account data...');
                    await fetchAccounts();
                } else {
                    throw new Error(data.error || 'Failed to connect bank');
                }
            } catch (err) {
                const errorMsg = 'Error connecting bank: ' + (err as Error).message;
                console.error('❌', errorMsg);
                setError(errorMsg);
            } finally {
                setIsConnecting(false);
            }
        },
        onExit: (err: Error | null) => {
            if (err) {
                console.log('⚠️ Plaid Link exit with error:', err);
            } else {
                console.log('ℹ️ User exited Plaid Link flow');
            }
            setIsConnecting(false);
        },
    });

    const fetchAccounts = async () => {
        if (!user) return;

        console.log('📊 Fetching connected accounts...');
        setLoading(true);
        setError('');

        try {
            const authToken = await getAuthToken();
            const data = await callSupabaseFunction('plaid-get-accounts', {}, authToken);
            setAccounts(data.accounts || []);
            console.log(`✅ Retrieved ${data.accounts?.length || 0} accounts`);
        } catch (err) {
            const errorMsg = 'Error fetching accounts: ' + (err as Error).message;
            console.error('❌', errorMsg);
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // Single button handler - does everything in background
    const handleAddAccount = async () => {
        console.log('🚀 Starting bank account connection flow...');
        setIsConnecting(true);

        // Step 1: Generate link token if we don't have one
        let token = linkToken;
        if (!token) {
            token = await getLinkToken();
        }

        // Step 2: Open Plaid Link if token is ready
        if (token && ready) {
            console.log('🔓 Opening Plaid Link modal...');
            open();
        } else if (!ready) {
            console.log('⏳ Plaid Link not ready yet, waiting...');
            setError('Plaid Link is loading, please try again in a moment');
            setIsConnecting(false);
        } else {
            setIsConnecting(false);
        }
    };

    // Auto-fetch accounts when modal opens
    useEffect(() => {
        if (isOpen && user) {
            console.log('🔄 Modal opened, fetching existing accounts...');
            fetchAccounts();
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#03c6fc]/5 to-[#03c6fc]/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#03c6fc]/10 rounded-lg flex items-center justify-center">
                            <Banknote className="w-5 h-5 text-[#03c6fc]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Financial Accounts</h2>
                            <p className="text-sm text-gray-500">Connect your bank accounts securely</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium text-red-900">Connection Error</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {!user && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CreditCard className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Sign In Required</h3>
                            <p className="text-gray-600">Please sign in to connect your bank accounts.</p>
                        </div>
                    )}

                    {user && (
                        <>
                            {/* Add Account Section */}
                            <div className="mb-8">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Bank</h3>
                                    <p className="text-gray-600 text-sm max-w-md mx-auto">
                                        Securely connect your bank account to automatically track your financial data.
                                        We use bank-level security through Plaid.
                                    </p>
                                </div>

                                <div className="flex justify-center">
                                    <button
                                        onClick={handleAddAccount}
                                        disabled={isConnecting || loading}
                                        className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#03c6fc] to-[#03c6fc]/80 text-white rounded-lg hover:from-[#03c6fc]/90 hover:to-[#03c6fc]/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md font-medium"
                                    >
                                        {(isConnecting || loading) ? (
                                            <>
                                                <RefreshCw className="w-5 h-5 animate-spin" />
                                                {isConnecting ? 'Connecting...' : 'Loading...'}
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-5 h-5" />
                                                Add Account
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Sandbox Instructions */}
                                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="flex items-start gap-3">
                                        <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="text-blue-600 text-xs font-bold">i</span>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-blue-900 mb-1">Sandbox Testing</h4>
                                            <p className="text-sm text-blue-800 mb-2">
                                                This is a demo environment. Use these test credentials:
                                            </p>
                                            <div className="text-sm text-blue-800 space-y-1">
                                                <div><strong>Bank:</strong> First Platypus Bank</div>
                                                <div><strong>Username:</strong> user_good</div>
                                                <div><strong>Password:</strong> pass_good</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Connected Accounts */}
                            {accounts.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-medium text-gray-900">
                                            Connected Accounts ({accounts.length})
                                        </h3>
                                        <button
                                            onClick={fetchAccounts}
                                            disabled={loading}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[#03c6fc] hover:bg-[#03c6fc]/5 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                            Refresh
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {accounts.map((account) => (
                                            <div key={account.account_id} className="bg-gradient-to-r from-gray-50 to-gray-50/50 p-4 rounded-lg border border-gray-200 hover:border-[#03c6fc]/20 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-[#03c6fc]/10 rounded-lg flex items-center justify-center">
                                                            <Building className="w-5 h-5 text-[#03c6fc]" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">{account.name}</div>
                                                            <div className="text-sm text-gray-500">
                                                                {account.institution_name} • {account.type} • {account.subtype}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-semibold text-gray-900">
                                                            ${account.balances.current?.toLocaleString('en-US', {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            }) || '0.00'}
                                                        </div>
                                                        {account.balances.available !== null && account.balances.available !== account.balances.current && (
                                                            <div className="text-sm text-gray-500">
                                                                Available: ${account.balances.available?.toLocaleString('en-US', {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2
                                                                }) || '0.00'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {accounts.length === 0 && !loading && !isConnecting && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CreditCard className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Accounts Connected</h3>
                                    <p className="text-gray-600">Connect your first bank account to get started.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Secured by Plaid • Bank-level encryption • Read-only access</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlaidDemo;