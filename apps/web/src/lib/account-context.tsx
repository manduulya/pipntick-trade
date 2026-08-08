"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TradingAccount } from "@pipntick/shared";
import { useAccounts } from "./hooks";

const STORAGE_KEY = "pipntick_selected_account_id";

type AccountContextValue = {
  accounts: TradingAccount[];
  accountsLoading: boolean;
  accountsError: unknown;
  selectedAccountId: string | null;
  selectedAccount: TradingAccount | null;
  setSelectedAccountId: (id: string) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function SelectedAccountProvider({ children }: { children: React.ReactNode }) {
  const { data: accounts, isLoading, isError, error } = useAccounts();
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!accounts) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedValid = stored ? accounts.some((a) => a.id === stored) : false;

    if (storedValid) {
      setSelectedAccountIdState(stored);
    } else {
      const fallback = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
      setSelectedAccountIdState(fallback?.id ?? null);
      if (fallback) localStorage.setItem(STORAGE_KEY, fallback.id);
    }
  }, [accounts]);

  const setSelectedAccountId = useCallback((id: string) => {
    setSelectedAccountIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const selectedAccount = useMemo(
    () => accounts?.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      accounts: accounts ?? [],
      accountsLoading: isLoading,
      accountsError: isError ? error : null,
      selectedAccountId,
      selectedAccount,
      setSelectedAccountId,
    }),
    [accounts, isLoading, isError, error, selectedAccountId, selectedAccount, setSelectedAccountId],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useSelectedAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useSelectedAccount must be used within SelectedAccountProvider");
  return ctx;
}
