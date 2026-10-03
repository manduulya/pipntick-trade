"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@pipntick/shared";
import { useTheme } from "../../../../lib/theme-context";
import { formatChartTime, pricePrecision, type ChartMarker } from "../../../../lib/trade-review-utils";
import { TradeMarkersPrimitive } from "./tradeMarkersPrimitive";

// TradingView Lightweight Charts (Apache-2.0). The default TradingView attribution logo is left
// on — the library's license asks for it.

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function TradeChart({
  candles,
  markers,
  entryPrice,
  exitPrice,
  timeZone,
  focus,
}: {
  candles: Candle[];
  markers: ChartMarker[];
  entryPrice: number;
  exitPrice: number | null;
  /** IANA zone for axis/crosshair labels (the account's broker clock). */
  timeZone: string;
  /** Time range (unix seconds) to open on — the trade plus some context (tradeFocusRange). */
  focus: { from: number; to: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const text = cssVar("--color-text-secondary", "#8899aa");
    const border = cssVar("--color-border", "#1a2d4a");
    const precision = pricePrecision(entryPrice);

    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: text, fontSize: 11 },
      grid: { vertLines: { color: `${border}55` }, horzLines: { color: `${border}55` } },
      rightPriceScale: { borderColor: border },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, type: TickMarkType) =>
          formatChartTime(time as number, timeZone, type === TickMarkType.Year || type === TickMarkType.Month || type === TickMarkType.DayOfMonth),
      },
      localization: { timeFormatter: (time: Time) => formatChartTime(time as number, timeZone, true) },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#7cc943",
      downColor: "#f05252",
      borderUpColor: "#7cc943",
      borderDownColor: "#f05252",
      wickUpColor: "#7cc943",
      wickDownColor: "#f05252",
      priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision },
      // Keep the entry/exit price lines in view even if they sit just outside the candles' range.
      autoscaleInfoProvider: (base: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
        const info = base();
        if (!info?.priceRange) return info;
        const prices = [entryPrice, ...(exitPrice !== null ? [exitPrice] : [])];
        return {
          ...info,
          priceRange: {
            minValue: Math.min(info.priceRange.minValue, ...prices),
            maxValue: Math.max(info.priceRange.maxValue, ...prices),
          },
        };
      },
    });
    series.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));

    // Entry / exit price levels.
    series.createPriceLine({ price: entryPrice, color: "#22d3ee", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Entry" });
    if (exitPrice !== null) {
      series.createPriceLine({ price: exitPrice, color: "#f5a524", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Exit" });
    }
    // Custom-drawn, outlined entry/exit marks with labels (built-in markers can't be styled this way).
    series.attachPrimitive(new TradeMarkersPrimitive(markers));

    // Open on the trade, not the whole fetched window (1h/1d windows span days). Clamped to the
    // data so a trade near either edge doesn't open on empty space.
    const first = candles[0]?.time;
    const last = candles[candles.length - 1]?.time;
    if (focus && first !== undefined && last !== undefined && focus.to > first && focus.from < last) {
      chart.timeScale().setVisibleRange({
        from: Math.max(focus.from, first) as UTCTimestamp,
        to: Math.min(focus.to, last) as UTCTimestamp,
      });
    } else {
      chart.timeScale().fitContent();
    }

    return () => {
      chart.remove();
      chartRef.current = null;
    };
    // Rebuilt on data/theme change — cheap at a few hundred candles, and keeps the chart stateless.
  }, [candles, markers, entryPrice, exitPrice, timeZone, theme, focus?.from, focus?.to]);

  return <div ref={containerRef} className="w-full h-full" />;
}
