import React, { useState } from 'react';
import { Mail, Lock, Key, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PasswordResetModal } from './PasswordResetModal';
import { LegalDocumentModal } from './LegalDocumentModal';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../data/legalDocuments';

type AuthStep = 'email' | 'signup' | 'login' | 'preview-confirmation';

export const CustomAuth: React.FC = () => {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isNewTeam, setIsNewTeam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkUserExists = async (email: string): Promise<boolean> => {
    try {
      // Check if user exists in the public users table
      const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .limit(1);

      if (error) {
        console.error('Error checking user:', error);
        return false;
      }

      // If we find a user in the public users table, they exist
      return users && users.length > 0;
    } catch (err) {
      console.error('Error checking user:', err);
      return false;
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email) {
        setError('Email is required');
        setLoading(false);
        return;
      }

      if (!validateEmail(email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      const userExists = await checkUserExists(email.trim().toLowerCase());

      if (userExists) {
        setStep('login');
      } else {
        setStep('signup');
        // Don't pre-populate confirm email - user should enter it again
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validateInviteCode = async (code: string, email: string): Promise<{ valid: boolean; inviteData?: any }> => {
    try {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error validating invite code:', error);
        return { valid: false };
      }

      if (!data) {
        setError('Invalid invite code');
        return { valid: false };
      }

      if (data.invited_email && data.invited_email.toLowerCase() !== email.toLowerCase()) {
        setError('This invite code is for a different email address');
        return { valid: false };
      }

      if (data.current_uses >= data.max_uses) {
        setError('This invite code has reached its maximum uses');
        return { valid: false };
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('This invite code has expired');
        return { valid: false };
      }

      // Set whether this is a new team invite
      setIsNewTeam(!data.team_id);

      return { valid: true, inviteData: data };
    } catch (err) {
      console.error('Error validating invite code:', err);
      setError('Failed to validate invite code');
      return { valid: false };
    }
  };

  React.useEffect(() => {
    const checkInviteEmailMatch = async () => {
      if (inviteCode && email && inviteCode.length >= 6) {
        const { data } = await supabase
          .from('invite_codes')
          .select('invited_email, team_id')
          .eq('code', inviteCode.toUpperCase())
          .maybeSingle();

        if (data?.invited_email && data.invited_email.toLowerCase() !== email.toLowerCase()) {
          setError('Email does not match the invited email for this code');
        } else if (error && error.includes('Email does not match')) {
          setError('');
        }

        // Update isNewTeam state based on invite code
        if (data) {
          setIsNewTeam(!data.team_id);
        }
      }
    };

    checkInviteEmailMatch();
  }, [inviteCode, email]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !confirmEmail || !password || !confirmPassword || !inviteCode) {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      if (!acceptedTerms) {
        setError('You must accept the Privacy Policy and Terms of Service to create an account');
        setLoading(false);
        return;
      }

      if (!validateEmail(email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
        setError('Email addresses do not match');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const { valid, inviteData } = await validateInviteCode(inviteCode, email);
      if (!valid || !inviteData) {
        setLoading(false);
        return;
      }

      // Check if this is a "new team" invite (no team_id)
      const isCreatingNewTeam = !inviteData.team_id;

      console.log('Attempting signup for:', email);

      // Step 1: Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            invite_code: inviteCode.toUpperCase(),
            is_new_team: isCreatingNewTeam,
            pending_team_setup: isCreatingNewTeam // Flag that team name is needed
          }
        }
      });

      console.log('Signup response:', { data, error });

      if (error) {
        console.error('Supabase signup error:', error);
        throw error;
      }

      if (!data.user) {
        throw new Error('User created but no user data returned');
      }

      console.log('Auth user created successfully:', data.user.id);

      // Step 2: For existing team joins, the trigger has already assigned the team
      // We just need to wait a moment for the trigger to complete and then verify
      if (!isCreatingNewTeam) {
        console.log('Joining existing team - trigger should have assigned team');

        // Wait a moment for trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify the user was assigned to the team
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('team_id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (userError || !userData?.team_id) {
          console.error('Team assignment failed:', userError);
          throw new Error('Failed to assign team. Please try again.');
        }

        console.log('User successfully assigned to team:', userData.team_id);

        // Update auth metadata to include team_id so App.tsx knows user is onboarded
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            team_id: userData.team_id,
            pending_team_setup: false
          }
        });

        if (metadataError) {
          console.error('Failed to update auth metadata:', metadataError);
          // Don't throw - user is still setup, just log the error
        } else {
          // Force refresh the session to get updated metadata
          console.log('Refreshing session to get updated metadata');
          await supabase.auth.refreshSession();
        }
      } else {
        console.log('New team signup - will complete setup during onboarding');
      }

      // Record legal acceptance for both Privacy Policy and Terms of Service
      try {
        const userAgent = navigator.userAgent;
        // Note: We can't get the real IP address from client-side, so we'll record null

        await supabase.from('legal_acceptance').insert([
          {
            user_id: data.user.id,
            document_type: 'privacy_policy',
            version: PRIVACY_POLICY.lastUpdated,
            user_agent: userAgent
          },
          {
            user_id: data.user.id,
            document_type: 'terms_of_service',
            version: TERMS_OF_SERVICE.lastUpdated,
            user_agent: userAgent
          }
        ]);

        console.log('Legal acceptance recorded successfully');
      } catch (legalError) {
        console.error('Failed to record legal acceptance:', legalError);
        // Don't block signup if legal recording fails, but log it
      }
    } catch (err: any) {
      console.error('Signup error details:', {
        message: err.message,
        status: err.status,
        details: err.details,
        hint: err.hint,
        code: err.code
      });

      // Show the actual error message from the database
      let errorMessage = err.message || 'Failed to create account';

      // If it's a database error with more details, include them
      if (err.details) {
        errorMessage += ` (${err.details})`;
      }
      if (err.hint) {
        errorMessage += ` Hint: ${err.hint}`;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewRequest = async () => {
    setError('');

    // Validate both email fields are filled and match BEFORE setting loading state
    if (!email || !confirmEmail) {
      setError('Please enter your email in both fields before requesting preview access');
      // Scroll to error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
      setError('Email addresses do not match');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setPreviewLoading(true);

    try {
      // Submit preview request to database
      const { error: insertError } = await supabase
        .from('preview_requests')
        .insert({
          email: email.toLowerCase()
        });

      if (insertError) {
        console.error('Error submitting preview request:', insertError);
        setError('Failed to submit preview request. Please try again.');
        setPreviewLoading(false);
        return;
      }

      // Show confirmation screen
      setStep('preview-confirmation');
    } catch (err: any) {
      console.error('Preview request error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Email and password are required');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setError('');
    setPassword('');
    setConfirmPassword('');
    setInviteCode('');
  };

  // Preview Confirmation Screen
  if (step === 'preview-confirmation') {
    return (
      <div className="w-full">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-400 shadow-lg">
            <span className="text-6xl">✓</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center justify-center gap-3 flex-wrap">
            <span className="text-emerald-400">Preview Access Requested</span>
          </h1>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-6">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6 mb-6">
            <p className="text-white text-lg mb-4 text-center">
              You have signed up for Free Preview Access!
            </p>
            <p className="text-gray-300 text-sm text-center leading-relaxed">
              We estimate invitations being sent out in early December from{' '}
              <span className="text-blue-400 font-medium">Invite@RocketHub.ai</span>.
              We look forward to you joining then!
            </p>
          </div>

          <button
            onClick={() => {
              setStep('email');
              setEmail('');
              setConfirmEmail('');
              setError('');
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Email Entry
  if (step === 'email') {
    return (
      <div className="w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-5xl font-bold flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-400 shadow-lg flex-shrink-0">
              <span className="text-5xl">🚀</span>
            </div>
            <span className="text-blue-400">AI Rocket</span>
            <span className="text-white font-normal">+</span>
            <span className="text-emerald-400">Astra Intelligence</span>
          </h1>
          <p className="text-base md:text-lg text-gray-400 mt-4 max-w-xl mx-auto">
            Launching AI-Powered Businesses for Entrepreneurs and their Teams
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-6">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={loading}
                  className="w-full pl-10 pr-14 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-center text-sm text-gray-400">
                Invite Code or Free Preview Signup
              </p>
            </div>
          </form>

          {/* Powered By Section */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-center text-gray-400 text-xs mb-3">Powered by</p>
            <div className="flex justify-center items-center gap-6">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 mb-1 flex items-center justify-center">
                  <img
                    src="/claude logo.png"
                    alt="Claude"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <p className="text-white text-xs font-medium">Claude</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 mb-1 flex items-center justify-center">
                  <img
                    src="/gemini app logo.jpeg"
                    alt="Gemini"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <p className="text-white text-xs font-medium">Gemini</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 mb-1 flex items-center justify-center">
                  <img
                    src="/gpt app logo.png"
                    alt="OpenAI"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <p className="text-white text-xs font-medium">OpenAI</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Sign Up or Login
  return (
    <>
      <PasswordResetModal
        isOpen={showPasswordReset}
        onClose={() => setShowPasswordReset(false)}
        defaultEmail={email}
      />

      <LegalDocumentModal
        isOpen={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
        document={PRIVACY_POLICY}
      />

      <LegalDocumentModal
        isOpen={showTermsOfService}
        onClose={() => setShowTermsOfService(false)}
        document={TERMS_OF_SERVICE}
      />

      <div className="w-full">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-blue-400 shadow-lg">
            <span className="text-4xl">🚀</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-center gap-3 flex-wrap">
            <span className="text-blue-400">AI Rocket</span>
            <span className="text-white font-normal">+</span>
            <span className="text-emerald-400">Astra Intelligence</span>
          </h1>
          <p className="text-base md:text-lg text-gray-400 mt-3 max-w-xl mx-auto">
            Launching AI-Powered Businesses for Entrepreneurs and their Teams
          </p>
        </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">
            {step === 'signup' ? 'Create Free Account' : 'Welcome Back'}
          </h2>
          <button
            onClick={handleBack}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Change email
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={step === 'signup' ? handleSignUp : handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>
          </div>

          {step === 'signup' && (
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Confirm Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Confirm your email"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={step === 'signup' ? 'Choose a password (min 6 characters)' : 'Your password'}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>
            {step === 'login' && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>

          {step === 'signup' && (
            <>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Invite Code</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Enter your invite code"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                    required
                  />
                </div>
              </div>

              {isNewTeam && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-400 text-sm">
                    <strong>New Team Signup</strong> - You'll set your team name in the next step
                  </p>
                </div>
              )}

              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    required
                  />
                  <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPrivacyPolicy(true);
                      }}
                      className="text-blue-400 hover:text-blue-300 underline font-medium"
                    >
                      Privacy Policy
                    </button>
                    {' '}and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsOfService(true);
                      }}
                      className="text-blue-400 hover:text-blue-300 underline font-medium"
                    >
                      Terms of Service
                    </button>
                  </span>
                </label>
              </div>
            </>
          )}

          {step === 'signup' && (
            <button
              type="button"
              onClick={handlePreviewRequest}
              disabled={previewLoading}
              className="w-full py-3 mt-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2 border border-purple-500"
            >
              {previewLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>No Invite Code? Request Free Preview Access Here</span>
              )}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2 mt-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{step === 'signup' ? 'Creating Account...' : 'Logging In...'}</span>
              </>
            ) : (
              <span>{step === 'signup' ? 'Create Account' : 'Log In'}</span>
            )}
          </button>
        </form>

        {step === 'signup' && (
          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-400 text-sm font-medium mb-2">Welcome to AI Rocket + Astra Intelligence!</p>
            <ul className="text-gray-400 text-xs space-y-1">
              <li>• Create your account instantly with a valid invite code</li>
              <li>• No email confirmation required - get started immediately</li>
              <li>• Access AI-powered insights for your business</li>
              <li>• Connect your data sources and collaborate with your team</li>
            </ul>
          </div>
        )}
      </div>
    </div>
    </>
  );
};
