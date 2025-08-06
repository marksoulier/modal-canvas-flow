import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onUpgrade?: () => void;
  mode?: 'signIn' | 'signUp';
  setMode?: (mode: 'signIn' | 'signUp') => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSignIn, mode, setMode }) => {
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, logAnonymousButtonClick } = useAuth();

  const internalIsSignUp = typeof mode === 'string' ? mode === 'signUp' : false;
  const setIsSignUp = setMode || (() => { });

  // Password strength validation
  const getPasswordStrength = (password: string) => {
    let score = 0;
    let feedback = [];

    if (password.length >= 8) score++;
    else feedback.push('At least 8 characters');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('One uppercase letter');

    if (/[a-z]/.test(password)) score++;
    else feedback.push('One lowercase letter');

    if (/\d/.test(password)) score++;
    else feedback.push('One number');

    if (/[^A-Za-z0-9]/.test(password)) score++;
    else feedback.push('One special character');

    return { score, feedback };
  };

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword;

  // Helper function to clear all form fields
  const clearForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  // Handle going to sign in from email confirmation modal
  const handleGoToSignIn = () => {
    setShowEmailConfirmation(false);
    setIsSignUp('signIn');
    clearForm();
    setError(null);
  };

  // Handle closing email confirmation modal
  const handleCloseEmailConfirmation = () => {
    setShowEmailConfirmation(false);
    clearForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Log button click for analytics
    if (logAnonymousButtonClick) {
      if (internalIsSignUp) {
        await logAnonymousButtonClick('sign_up');
      } else {
        await logAnonymousButtonClick('sign_in');
      }
    }

    // Additional validation for sign up
    if (internalIsSignUp) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (passwordStrength.score < 3) {
        setError('Password is too weak. Please include: ' + passwordStrength.feedback.join(', '));
        return;
      }
    }

    setIsLoading(true);

    try {
      console.log(`🔄 ${internalIsSignUp ? 'Sign up' : 'Sign in'} attempt for:`, email);

      if (internalIsSignUp) {
        const profileData = {};

        const result = await signUp(email, password, profileData) as any;
        console.log('📝 Sign up result:', result);

        // Check if user needs email confirmation
        if (result?.user && !result.session) {
          setUserEmail(email);
          setShowEmailConfirmation(true);
          setIsLoading(false);
          return;
        }
      } else {
        const result = await signIn(email, password) as any;
        console.log('🔑 Sign in result:', result);

        // Verify we actually got a session
        if (!result?.session) {
          throw new Error('No session created - please check your credentials');
        }
      }

      console.log('✅ Authentication completed successfully');

      // Clear form
      clearForm();
      setIsLoading(false);

      // Close modal
      onSignIn();
    } catch (err: any) {
      console.error('❌ Authentication error:', err);

      // Handle specific Supabase error codes
      let errorMessage = 'An error occurred';
      if (err?.message) {
        if (err.message.includes('Invalid login credentials')) {
          errorMessage = internalIsSignUp ? 'Failed to create account. Please try again.' : 'Invalid email or password. Please try again.';
        } else if (err.message.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
          setIsSignUp('signIn'); // Switch to sign in mode
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email for a confirmation link.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    if (logAnonymousButtonClick) {
      await logAnonymousButtonClick('google_sign_in');
    }

    try {
      console.log('🔄 Google sign in attempt');
      console.log('🔄 Window location origin:', window.location.origin + '/');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/',
        },
      });
      if (error) throw error;

      // Set flag to indicate this is the first Google sign-in
      localStorage.setItem('first-google-signin', 'true');

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Email Confirmation Modal */}
      <Dialog open={showEmailConfirmation} onOpenChange={(open) => {
        if (!open) handleCloseEmailConfirmation();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check Your Email</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.95a3 3 0 003.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900">Verify your email address</h3>
              <p className="text-sm text-gray-600 mt-2">
                We've sent a confirmation link to <strong>{userEmail}</strong>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Click the link in your email to verify your account, then come back to sign in.
              </p>
            </div>

            <div className="space-y-3">
              <Button onClick={handleGoToSignIn} className="w-full">
                Go to Sign In
              </Button>
              <Button
                onClick={handleCloseEmailConfirmation}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Auth Modal */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        console.log('Dialog open state changing to:', open);
        if (!open) onClose();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{internalIsSignUp ? 'Create Account' : 'Welcome Back'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {internalIsSignUp && (
              <>
                {/* Removed firstName, lastName, birthDate, location, education fields */}
              </>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
              {internalIsSignUp && password && (
                <div className="mt-2">
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded ${level <= passwordStrength.score
                          ? passwordStrength.score <= 2
                            ? 'bg-red-500'
                            : passwordStrength.score <= 3
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          : 'bg-gray-200'
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Strength: {passwordStrength.score <= 2 ? 'Weak' : passwordStrength.score <= 3 ? 'Fair' : 'Strong'}
                  </p>
                  {passwordStrength.feedback.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Missing: {passwordStrength.feedback.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {internalIsSignUp && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md ${confirmPassword && !passwordsMatch ? 'border-red-500' : ''
                    }`}
                  required
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
                {confirmPassword && passwordsMatch && (
                  <p className="text-xs text-green-600">Passwords match ✓</p>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Loading...' : internalIsSignUp ? 'Create Account' : 'Sign In'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full"
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  if (internalIsSignUp) {
                    setIsSignUp('signIn');
                  } else {
                    setIsSignUp('signUp');
                  }
                }}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                {internalIsSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AuthModal;
