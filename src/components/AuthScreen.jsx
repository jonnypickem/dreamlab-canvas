import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthScreen({ onAuthenticated }) {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (mode === 'signup') {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (signUpError) throw signUpError;
                setMessage('Check your email for a confirmation link.');
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
                onAuthenticated?.();
            }
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-neutral-50">
            <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-heading-2 font-heading-2 text-default-font">
                        Dreamlab
                    </h1>
                    <p className="mt-1 text-caption font-caption text-subtext-color">
                        {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-caption-bold font-caption-bold text-subtext-color">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-body font-body text-default-font outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-caption-bold font-caption-bold text-subtext-color">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-body font-body text-default-font outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                            placeholder="At least 6 characters"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg bg-error-50 px-3 py-2 text-caption font-caption text-error-700">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="rounded-lg bg-success-50 px-3 py-2 text-caption font-caption text-success-700">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-1 rounded-lg bg-brand-600 px-4 py-2.5 text-body-bold font-body-bold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-5 text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setMode(mode === 'login' ? 'signup' : 'login');
                            setError(null);
                            setMessage(null);
                        }}
                        className="text-caption font-caption text-subtext-color hover:text-default-font"
                    >
                        {mode === 'login'
                            ? "Don't have an account? Sign up"
                            : 'Already have an account? Sign in'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
