// Shared types between web and api

export interface Trade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  timestamp: string;
}

export interface Portfolio {
  id: string;
  userId: string;
  positions: Position[];
  totalValue: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
}
