import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

/**
 * Service-role client. Bypasses RLS. Server-only.
 * Used for: signed upload URL creation, video row inserts,
 * cross-owner administrative operations.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient called from a browser context');
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
