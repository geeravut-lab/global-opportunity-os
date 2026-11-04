import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountContext, AccountData } from "./types";
export async function loadAccount(
  client: SupabaseClient,
  locale: string,
): Promise<{
  data: AccountData | null;
  error: { code?: string; message?: string } | null;
}> {
  const contextResult = await client.rpc("goos_context");
  if (contextResult.error) return { data: null, error: contextResult.error };
  const context = contextResult.data as AccountContext;
  const results = await Promise.all([
    context.subject_id
      ? client.rpc("goos_profile", { p_subject_id: context.subject_id })
      : Promise.resolve({ data: null, error: null }),
    client.rpc("goos_notices", { p_locale: locale }),
    client.rpc("goos_delegations"),
    client.rpc("goos_organizations"),
    client.rpc("goos_my_invitations"),
    client.rpc("goos_consents"),
    client.auth.mfa.listFactors(),
  ]);
  const error = results.find((r) => r.error)?.error;
  if (error) return { data: null, error };
  const [
    profile,
    notices,
    delegations,
    organizations,
    invitations,
    consents,
    factors,
  ] = results;
  return {
    data: {
      context,
      profile: profile.data,
      notices: notices.data,
      delegations: delegations.data,
      organizations: organizations.data,
      invitations: invitations.data,
      consents: consents.data,
      factors: (factors.data?.all ?? [])
        .filter((f) => f.factor_type === "totp")
        .map((f) => ({
          id: f.id,
          friendly_name: f.friendly_name,
          status: f.status,
        })),
    } as AccountData,
    error: null,
  };
}
