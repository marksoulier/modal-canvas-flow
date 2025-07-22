import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAuth } from '../contexts/AuthContext';
import { callSupabaseFunction, supabase } from '../integrations/supabase/client';
import { X, CreditCard, Building, RefreshCw, AlertCircle } from 'lucide-react';

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

    const { user } = useAuth();

    // Get the auth token from Supabase session
    const getAuthToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token;
    };

    // Get Link Token from Plaid
    const getLinkToken = async () => {
        if (!user) {
            setError('Please sign in to connect bank accounts');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('https://sandbox.plaid.com/link_token/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: '687fb92af661c10022bb19bc', // Your Plaid Client ID - get from dashboard
                    secret: '5ae2f20dfbd66774e701d270239a1f', // Your Plaid Sandbox Secret - REPLACE THIS
                    client_name: 'Retirement Planning Tool',
                    country_codes: ['US'],
                    language: 'en',
                    user: {
                        client_user_id: user.id,
                    },
                    products: ['accounts'],
                }),
            });

            const data = await response.json();

            if (data.link_token) {
                setLinkToken(data.link_token);
            } else {
                setError('Failed to get link token: ' + (data.error_message || 'Unknown error'));
            }
        } catch (err) {
            setError('Error getting link token: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: async (public_token) => {
            setLoading(true);
            setError('');

            try {
                const authToken = await getAuthToken();
                const data = await callSupabaseFunction('plaid-exchange-token', { public_token }, authToken);

                if (data.success) {
                    console.log('✅ Bank connected!', data.institution_name);
                    await fetchAccounts();
                } else {
                    throw new Error(data.error || 'Failed to connect bank');
                }
            } catch (err) {
                setError('Error connecting bank: ' + (err as Error).message);
                console.error('Plaid connection error:', err);
            } finally {
                setLoading(false);
            }
        },
        onExit: (err) => {
            if (err) {
                console.log('Plaid Link exit with error:', err);
            }
        },
    });

    const fetchAccounts = async () => {
        if (!user) return;

        setLoading(true);
        setError('');

        try {
            const authToken = await getAuthToken();
            const data = await callSupabaseFunction('plaid-get-accounts', {}, authToken);
            setAccounts(data.accounts || []);
        } catch (err) {
            setError('Error fetching accounts: ' + (err as Error).message);
            console.error('Error fetching accounts:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch accounts on component mount if user is logged in
    useEffect(() => {
        if (isOpen && user) {
            fetchAccounts();
        }
    }, [isOpen, user]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Plaid Demo - Connect Your Accounts
                        </h2>
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
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium text-red-900">Error</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {!user && (
                        <div className="text-center py-8">
                            <p className="text-gray-600">Please sign in to connect your bank accounts.</p>
                        </div>
                    )}

                    {user && (
                        <>
                            <div className="mb-6">
                                <h3 className="text-lg font-medium mb-2">Connect Bank Account</h3>
                                <p className="text-gray-600 text-sm mb-4">
                                    Use Plaid's sandbox to test connecting bank accounts. Try these test credentials:
                                </p>
                                <div className="bg-blue-50 p-4 rounded-lg text-sm">
                                    <strong>Test Bank:</strong> First Platypus Bank<br />
                                    <strong>Username:</strong> user_good<br />
                                    <strong>Password:</strong> pass_good
                                </div>
                            </div>

                            <div className="flex gap-3 mb-6">
                                {!linkToken && (
                                    <button
                                        onClick={getLinkToken}
                                        disabled={loading}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                        Generate Link Token
                                    </button>
                                )}

                                {linkToken && (
                                    <button
                                        onClick={() => open()}
                                        disabled={!ready || loading}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                        {loading ? 'Connecting...' : 'Connect Bank Account'}
                                    </button>
                                )}

                                <button
                                    onClick={fetchAccounts}
                                    disabled={loading}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    Refresh Accounts
                                </button>
                            </div>

                            {accounts.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-medium mb-4">Connected Accounts ({accounts.length})</h3>
                                    <div className="space-y-3">
                                        {accounts.map((account) => (
                                            <div key={account.account_id} className="bg-gray-50 p-4 rounded-lg border">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Building className="w-5 h-5 text-gray-500" />
                                                        <div>
                                                            <div className="font-medium text-gray-900">{account.name}</div>
                                                            <div className="text-sm text-gray-500">
                                                                {account.institution_name} • {account.type} • {account.subtype}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-green-600">
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
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <p className="text-xs text-gray-500 text-center">
                        This is a sandbox demo. No real financial data is accessed or stored.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlaidDemo; 