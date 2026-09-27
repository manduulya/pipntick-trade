"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import type {
  CreateAccountInput,
  CreateTradeInput,
  SaveRulesInput,
  TradePlan,
  TradingAccount,
  UpdatePlanInput,
} from "@pipntick/shared";
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

// ─── Trade Plan ────────────────────────────────────────────────────────────

export function useRules(accountId?: string | null) {
  const { getToken } = useAuth();
  const { selectedAccountId } = useSelectedAccount();
  const id = accountId ?? selectedAccountId;
  return useQuery({
    queryKey: ["rules", id],
    queryFn: async () => api.rules.list(await getToken(), id!),
    enabled: !!id,
  });
}

export function useSaveRules(accountId?: string | null) {
  const { getToken } = useAuth();
  const { selectedAccountId } = useSelectedAccount();
  const id = accountId ?? selectedAccountId;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rules: SaveRulesInput) => api.rules.save(await getToken(), id!, rules),
    onSuccess: (saved) => {
      queryClient.setQueryData(["rules", id], saved);
    },
  });
}

/** Plans for the week [from, to] (inclusive "YYYY-MM-DD" keys) on the selected account. */
export function usePlans(from: string, to: string) {
  const { getToken } = useAuth();
  const { selectedAccountId } = useSelectedAccount();
  return useQuery({
    queryKey: ["plans", selectedAccountId, from, to],
    queryFn: async () => api.plans.list(await getToken(), selectedAccountId!, from, to),
    enabled: !!selectedAccountId,
  });
}

export function useCreatePlan() {
  const { getToken } = useAuth();
  const { selectedAccountId } = useSelectedAccount();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planDate: string) =>
      api.plans.create(await getToken(), { accountId: selectedAccountId ?? undefined, planDate }),
    onSuccess: (plan) => {
      // Append to whichever cached week contains the new plan's day, so the tile shows up (and can
      // open expanded) without waiting on a refetch.
      for (const [key, data] of queryClient.getQueriesData<TradePlan[]>({ queryKey: ["plans", selectedAccountId] })) {
        const [, , from, to] = key as [string, string, string, string];
        if (data && plan.planDate >= from && plan.planDate <= to) {
          queryClient.setQueryData(key, [...data, plan]);
        }
      }
    },
  });
}

function replacePlanInCache(queryClient: ReturnType<typeof useQueryClient>, plan: TradePlan) {
  queryClient.setQueriesData<TradePlan[]>({ queryKey: ["plans"] }, (old) =>
    old ? old.map((p) => (p.id === plan.id ? plan : p)) : old,
  );
}

/**
 * Patches a plan. `next` is the full plan as it should look after the change and is written to the
 * cache immediately (checkbox/grade clicks feel instant); `input` is what's actually sent. Refetches
 * once the last in-flight plan update settles, so overlapping clicks never flash a stale response.
 */
export function useUpdatePlan() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["updatePlan"],
    mutationFn: async ({ next, input }: { next: TradePlan; input: UpdatePlanInput }) =>
      api.plans.update(await getToken(), next.id, input),
    onMutate: async ({ next }) => {
      await queryClient.cancelQueries({ queryKey: ["plans"] });
      const snapshot = queryClient.getQueriesData<TradePlan[]>({ queryKey: ["plans"] });
      replacePlanInCache(queryClient, next);
      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["updatePlan"] }) <= 1) {
        queryClient.invalidateQueries({ queryKey: ["plans"] });
      }
    },
  });
}

export function useDeletePlan() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.plans.remove(await getToken(), id),
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<TradePlan[]>({ queryKey: ["plans"] }, (old) => (old ? old.filter((p) => p.id !== id) : old));
    },
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
