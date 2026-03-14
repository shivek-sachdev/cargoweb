'use client';

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode 
} from 'react';
import { 
  User, 
  Session, 
  AuthError 
} from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: AuthError | null;
    success: boolean;
  }>;
  signUp: (email: string, password: string) => Promise<{
    error: AuthError | null;
    success: boolean;
  }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check active sessions and sets the user
    const getSession = async () => {
      setIsLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
      }

      if (session) {
        console.log('Session found during initialization:', session.user.email);
        setSession(session);
        setUser(session.user);
      } else {
        console.log('No session found during initialization');
      }
      
      setIsLoading(false);
    };

    getSession();

    // Listen for changes to auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Auth state changed: ${event}`, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle navigation after certain auth events
        if (event === 'SIGNED_IN' && window.location.pathname === '/login') {
          console.log('User signed in, redirecting to dashboard');
          window.location.href = '/quotations';
        }
        
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error("Sign in error:", error);
        return { error, success: false };
      }
      
      if (data?.session) {
        console.log("Login successful, redirecting...");
        // Force a hard redirect instead of using router
        window.location.href = '/quotations';
        return { error: null, success: true };
      } else {
        console.error("No session after login");
        return { error: null, success: false };
      }
    } catch (e) {
      console.error("Login exception:", e);
      return { error: e as AuthError, success: false };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    
    setIsLoading(false);
    
    if (error) {
      return { error, success: false };
    }
    
    return { error: null, success: true };
  };

  // Sign out
  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    router.push('/login');
    setIsLoading(false);
  };

  const value = {
    user,
    session,
    isLoading,
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 