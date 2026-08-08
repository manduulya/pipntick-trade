"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import type { CreateAccountInput, CreateTradeInput, TradingAccount } from "@pipntick/shared";
import { api } from "./api";
import { useSelectedAccount } from "./account-context";

export function useTrades() {
  const { getToken } = useAuth();
  const { selectedAccountId, accountsLoading, accountsError } = useSelectedAccount();

  const query = useQuery({
    queryKey: ["trades", selectedAccountId],
    queryFn: async () => api.trades.list(await getToken(), selectedAccountId ?? undefined),
    enabled: !!selectedAccountId,
  });

  if (accountsError) {
    return { data: undefined, isLoading: false, isError: true, error: accountsError };
  }
  return {
    data: query.data,
    isLoading: query.isLoading || (!selectedAccountId && accountsLoading),
    isError: query.isError,
    error: query.error,
  };
}

export function useAccounts() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => api.accounts.list(await getToken()),
  });
}

export function useAccountTrades(accountId: string | null) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["trades", accountId],
    queryFn: async () => api.trades.list(await getToken(), accountId ?? undefined),
    enabled: !!accountId,
  });
}

export function useCreateTrade() {
  const { getToken } = useAuth();
  const { selectedAccountId } = useSelectedAccount();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTradeInput) =>
      api.trades.create(await getToken(), { ...input, accountId: input.accountId ?? selectedAccountId ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export function useUpdateTrade() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CreateTradeInput> }) =>
      api.trades.update(await getToken(), id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export function useDeleteTrade() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.trades.remove(await getToken(), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export function useUpdateAccount() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CreateAccountInput> }) =>
      api.accounts.update(await getToken(), id, input),
    onSuccess: (account) => {
      queryClient.setQueryData(["accounts"], (old: TradingAccount[] | undefined) =>
        old ? old.map((a) => (a.id === account.id ? account : a)) : [account],
      );
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteTradingAccount() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.accounts.remove(await getToken(), id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["accounts"], (old: TradingAccount[] | undefined) =>
        old ? old.filter((a) => a.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export function useDeleteAccount() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async () => api.account.delete(await getToken()),
  });
}

export function useParseTradeScreenshot() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (imageDataUrl: string) => api.screenshot.parseTrade(await getToken(), imageDataUrl),
  });
}

export function useCreateAccount() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAccountInput) => api.accounts.create(await getToken(), input),
    onSuccess: (account) => {
      queryClient.setQueryData(["accounts"], (old: TradingAccount[] | undefined) =>
        old ? [...old, account] : [account],
      );
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
