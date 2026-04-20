import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRole } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_CACHE_KEY = "examguard:role:";

function readCachedRole(userId: string): AppRole | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(ROLE_CACHE_KEY + userId);
    return v === "teacher" || v === "student" ? v : null;
  } catch {
    return null;
  }
}

function writeCachedRole(userId: string, role: AppRole | null) {
  if (typeof window === "undefined") return;
  try {
    if (role) localStorage.setItem(ROLE_CACHE_KEY + userId, role);
    else localStorage.removeItem(ROLE_CACHE_KEY + userId);
  } catch {
    /* ignore */
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const lastRoleFetchUserId = useRef<string | null>(null);

  const fetchRole = useCallback(async (userId: string) => {
    // Skip if already fetched for this user this session
    if (lastRoleFetchUserId.current === userId) return;
    lastRoleFetchUserId.current = userId;
    try {
      const r = await getUserRole(userId);
      setRole(r);
      writeCachedRole(userId, r);
    } catch {
      setRole(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Listener first, so we don't miss the INITIAL_SESSION event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          // Use cached role for instant render, then refresh in background
          const cached = readCachedRole(u.id);
          if (cached) setRole(cached);
          setLoading(false);
          fetchRole(u.id);
        } else {
          setRole(null);
          lastRoleFetchUserId.current = null;
          setLoading(false);
        }
      }
    );

    // Kick off initial session check (fires INITIAL_SESSION via listener)
    supabase.auth.getSession().catch(() => {
      if (mounted) setLoading(false);
    });

    // Safety timeout
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchRole]);

  return { user, role, loading };
}
