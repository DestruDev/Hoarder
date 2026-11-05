import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setActiveUser } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { startSync } from '@/lib/sync';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const NOT_CONFIGURED = 'Login is not configured. Add your Supabase URL and key to .env.';

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(supabase != null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    // Point the local database at this account before any screen can query it.
    const applySession = async (nextSession: Session | null) => {
      try {
        await setActiveUser(nextSession?.user.id ?? null);
      } catch (error) {
        console.error('[Hoarder] Failed to switch local data to this account:', error);
      }
      setSession(nextSession);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => (userId ? startSync(userId) : undefined), [userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      async signIn(email, password) {
        if (!supabase) {
          return NOT_CONFIGURED;
        }

        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error?.message ?? null;
      },
      async signUp(email, password) {
        if (!supabase) {
          return { error: NOT_CONFIGURED, needsConfirmation: false };
        }

        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
      },
      async signOut() {
        await supabase?.auth.signOut();
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
