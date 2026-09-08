import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => utils.auth.me.setData(undefined, null) });
  const localLoginMutation = trpc.auth.localLogin.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); } });

  const logout = useCallback(async () => {
    try { await logoutMutation.mutateAsync(); }
    catch (error: unknown) { if (!(error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED")) throw error; }
    finally { try { sessionStorage.removeItem("manus-cookie"); } catch {} utils.auth.me.setData(undefined, null); await utils.auth.me.invalidate(); }
  }, [logoutMutation, utils]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    await localLoginMutation.mutateAsync({ email, password });
    await meQuery.refetch();
  }, [localLoginMutation, meQuery]);

  const state = useMemo(() => {
    localStorage.setItem("manus-runtime-user-info", JSON.stringify(meQuery.data));
    return { user: meQuery.data ?? null, loading: meQuery.isLoading || logoutMutation.isPending || localLoginMutation.isPending, error: meQuery.error ?? logoutMutation.error ?? localLoginMutation.error ?? null, isAuthenticated: Boolean(meQuery.data) };
  }, [meQuery.data, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending, localLoginMutation.error, localLoginMutation.isPending]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || meQuery.isLoading || logoutMutation.isPending || localLoginMutation.isPending || state.user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    if (redirectPath) window.location.href = redirectPath; else startLogin();
  }, [redirectOnUnauthenticated, redirectPath, logoutMutation.isPending, localLoginMutation.isPending, meQuery.isLoading, state.user]);

  return { ...state, refresh: () => meQuery.refetch(), logout, loginWithEmail, loginPending: localLoginMutation.isPending };
}
