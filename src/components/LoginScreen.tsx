import React, { useState, startTransition } from 'react';
import { TEAM, TeamMember } from '../types.js';
import { Shield, Mail, Phone, Lock, Eye, EyeOff, Check, UserCheck, RefreshCw } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (member: TeamMember) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  // Auth view states
  const [mode, setMode] = useState<'credentials' | 'pin-entry' | 'pin-setup' | 'pin-reset'>('credentials');
  const [matchedMember, setMatchedMember] = useState<TeamMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Quick fill helper for local dev/testing
  const handleQuickFill = (m: TeamMember) => {
    setEmail(m.email);
    setPhone(m.phone);
    setError(null);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone })
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned status ${response.status}. Please make sure you configured FIREBASE_SERVICE_ACCOUNT on Vercel as explained in the guide.`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.setupRequired) {
        startTransition(() => {
          setMatchedMember(data.member);
          setMode('pin-setup');
        });
      } else if (data.pinRequired) {
        startTransition(() => {
          setMatchedMember(data.member);
          setMode('pin-entry');
        });
      } else if (data.success) {
        onLoginSuccess(data.member);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.trim().length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, pin })
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned status ${response.status}. Please make sure you configured FIREBASE_SERVICE_ACCOUNT on Vercel as explained in the guide.`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Incorrect PIN');
      }

      if (data.success) {
        onLoginSuccess(data.member);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.trim().length < 4) {
      setError('New PIN must be at least 4 digits');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, newPin: pin })
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned status ${response.status}. Please make sure you configured FIREBASE_SERVICE_ACCOUNT on Vercel as explained in the guide.`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Reset failed');
      }

      // Success
      setError(null);
      alert('Your PIN was successfully reset! Please log in now.');
      startTransition(() => {
        setMode('pin-entry');
        setPin('');
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/30 to-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:16px_24px]">
      <div className="max-w-md w-full mx-auto relative z-10">
        {/* Brand Logo & Header */}
        <div className="text-center mb-8 animate-fadeIn">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-orange-600 text-white shadow-xl shadow-orange-500/10 hover:rotate-6 transition-all duration-300 mb-4 border border-orange-500/20">
            <Shield className="h-7 w-7" id="login_shield_icon" />
          </div>
          <h1 className="text-3xl font-extrabold font-display text-slate-900 tracking-tight" id="login_title">
            PrintStop Sourcing
          </h1>
          <p className="mt-2 text-sm text-slate-500 font-medium" id="login_subtitle">
            Secure Co-Task Board and Team Collaboration
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-md py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-100/80 animate-fadeIn" id="login_card">
          {error && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200/60 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2.5 animate-fadeIn" id="login_error_alert">
              <span className="font-bold text-red-800">Error:</span> {error}
            </div>
          )}

          {/* MODE 1: Email & Phone Credentials */}
          {mode === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-5" id="login_credentials_form">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="login_email">
                  Team Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <input
                    id="login_email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@printstop.co.in"
                    className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/40 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="login_phone">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="h-4.5 w-4.5" />
                  </div>
                  <input
                    id="login_phone"
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="99999 99999"
                    className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/40 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                id="login_submit_btn"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-orange-600/15 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-6 cursor-pointer"
              >
                {loading ? 'Verifying...' : 'Verify Team Membership'}
              </button>
            </form>
          )}

          {/* MODE 2: Set PIN on first login */}
          {mode === 'pin-setup' && matchedMember && (
            <form onSubmit={handlePinSubmit} className="space-y-5" id="login_pin_setup_form">
              <div className="p-4 bg-orange-50/60 border border-orange-100/80 rounded-xl text-center mb-4">
                <p className="text-sm font-bold text-orange-900">
                  Welcome, <span className="text-orange-950">{matchedMember.name}</span>!
                </p>
                <p className="text-xs text-orange-600 mt-1 font-medium">
                  This is your first login. Please choose a personal PIN to secure your account.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="setup_pin">
                  Set Your Account PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="setup_pin"
                    type={showPin ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="At least 4 digits"
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl bg-slate-50/40 text-slate-900 placeholder-slate-400 tracking-widest text-center font-bold focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 focus:bg-white transition-all text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Write this down. You will need it to log in next time.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-emerald-600/15 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
              >
                {loading ? 'Saving...' : 'Set PIN & Enter Board'}
              </button>
            </form>
          )}

          {/* MODE 3: Return with PIN */}
          {mode === 'pin-entry' && matchedMember && (
            <form onSubmit={handlePinSubmit} className="space-y-5" id="login_pin_entry_form">
              <div className="p-4 bg-slate-50/60 border border-slate-100/80 rounded-xl text-center mb-4">
                <p className="text-sm font-bold text-slate-800">
                  Welcome Back, <span className="text-slate-950">{matchedMember.name}</span>!
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">Please enter your personal security PIN to log in.</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="entry_pin">
                  Enter Your PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="entry_pin"
                    type={showPin ? 'text' : 'password'}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl bg-slate-50/40 text-slate-900 placeholder-slate-400 tracking-widest text-center font-bold focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 focus:bg-white transition-all text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 font-medium">
                <button
                  type="button"
                  onClick={() => startTransition(() => { setMode('pin-reset'); setPin(''); setError(null); })}
                  className="text-xs text-orange-600 hover:text-orange-700 font-semibold cursor-pointer"
                >
                  Forgot your PIN? Reset it
                </button>
                <button
                  type="button"
                  onClick={() => startTransition(() => { setMode('credentials'); setPin(''); setError(null); })}
                  className="text-xs text-slate-500 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Change Email
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-orange-600/15 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-6 cursor-pointer"
              >
                {loading ? 'Logging in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* MODE 4: Reset PIN */}
          {mode === 'pin-reset' && (
            <form onSubmit={handlePinResetSubmit} className="space-y-5" id="login_pin_reset_form">
              <div className="p-4 bg-orange-50/60 border border-orange-100/80 rounded-xl text-center mb-4">
                <p className="text-sm font-bold text-orange-900">Reset Your Security PIN</p>
                <p className="text-xs text-orange-600 mt-1 font-medium">
                  Provide your email & phone number again. Since you are registered in the team, you can set a brand new PIN directly.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="reset_pin">
                  Set Your New PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="reset_pin"
                    type={showPin ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="At least 4 digits"
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl bg-slate-50/40 text-slate-900 placeholder-slate-400 tracking-widest text-center font-bold focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 focus:bg-white transition-all text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end mt-2">
                <button
                  type="button"
                  onClick={() => startTransition(() => { setMode('pin-entry'); setPin(''); setError(null); })}
                  className="text-xs text-slate-500 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  Back to Log In
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-orange-600/15 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-6 cursor-pointer"
              >
                {loading ? 'Resetting...' : 'Verify & Set New PIN'}
              </button>
            </form>
          )}
        </div>

        {/* Developer / Team Testing Helper */}
        <div className="mt-8 bg-white/60 backdrop-blur-md border border-slate-200/50 rounded-2xl p-4.5 text-center shadow-lg animate-fadeIn">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-orange-500" /> Sourcing Team Member quick-fill (for testing)
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {TEAM.map((m) => (
              <button
                key={m.id}
                onClick={() => handleQuickFill(m)}
                className="text-[11px] bg-white border border-slate-200/60 hover:border-orange-500/40 hover:bg-orange-50/20 text-slate-700 py-1.5 px-2.5 rounded-xl truncate transition-all duration-200 text-left flex items-center gap-1.5 font-bold cursor-pointer hover:shadow-xs"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0"></div>
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
