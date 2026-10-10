import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";
import type { Candle } from "@pipntick/shared";
import { timeToX, type PositionBox } from "../../../../lib/trade-review-utils";

// TradingView-style position box for the Trade Review chart: a translucent green zone from the
// entry to the furthest take-profit and a red zone from the entry to the stop (whichever exist —
// both are optional), spanning the trade's duration, with a line + label per target and a dashed
// entry→exit line. Drawn underneath the candles (zOrder "bottom"); the entry/exit marks
// (tradeMarkersPrimitive) stay on top.

type DrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

/** Width of a trade shorter than 5 minutes (its real span would be a sliver). */
const SHORT_TRADE_WIDTH = 72;
/** Any trade's box is at least this wide (e.g. a 10-minute trade on a 4h chart). */
const MIN_WIDTH = 24;

const GREEN_FILL = "rgba(124, 201, 67, 0.16)";
const GREEN_EDGE = "rgba(124, 201, 67, 0.55)";
const RED_FILL = "rgba(240, 82, 82, 0.16)";
const RED_EDGE = "rgba(240, 82, 82, 0.55)";
const LABEL_FONT = "700 11px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

type Geometry = {
  x1: number;
  x2: number;
  entryY: number;
  stopY: number | null;
  targetYs: { y: number; price: number }[];
  exit: { x: number; y: number } | null;
};

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = LABEL_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#0b1b33";
  ctx.fillText(text, x, y);
}

function zone(ctx: CanvasRenderingContext2D, x1: number, x2: number, yA: number, yB: number, fill: string, edge: string) {
  const top = Math.min(yA, yB);
  const h = Math.abs(yA - yB);
  ctx.fillStyle = fill;
  ctx.fillRect(x1, top, x2 - x1, h);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x1 + 0.5, top + 0.5, x2 - x1 - 1, Math.max(0, h - 1));
}

class BoxRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly g: Geometry | null, private readonly box: PositionBox | null) {}

  draw(target: DrawTarget) {
    const g = this.g;
    const box = this.box;
    if (!g || !box) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      // Profit zone to the furthest target, loss zone to the stop.
      if (g.targetYs.length) {
        const furthest = g.targetYs[g.targetYs.length - 1].y;
        zone(ctx, g.x1, g.x2, g.entryY, furthest, GREEN_FILL, GREEN_EDGE);
      }
      if (g.stopY !== null) zone(ctx, g.x1, g.x2, g.entryY, g.stopY, RED_FILL, RED_EDGE);

      // A line per target (TP1 nearest), and labels just right of the box.
      g.targetYs.forEach(({ y, price }, i) => {
        ctx.strokeStyle = GREEN_EDGE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g.x1, y + 0.5);
        ctx.lineTo(g.x2, y + 0.5);
        ctx.stroke();
        label(ctx, `TP${g.targetYs.length > 1 ? i + 1 : ""} ${price}`, g.x2 + 6, y);
      });
      if (g.stopY !== null && box.stopLoss !== null) label(ctx, `SL ${box.stopLoss}`, g.x2 + 6, g.stopY);

      // Entry level across the box, and a dashed path from entry to exit.
      ctx.strokeStyle = "rgba(201, 209, 220, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.x1, g.entryY + 0.5);
      ctx.lineTo(g.x2, g.entryY + 0.5);
      ctx.stroke();
      if (g.exit) {
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = "rgba(201, 209, 220, 0.85)";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(g.x1, g.entryY);
        ctx.lineTo(g.exit.x, g.exit.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }
}

class BoxPaneView implements IPrimitivePaneView {
  private geometry: Geometry | null = null;
  constructor(private readonly source: PositionBoxPrimitive) {}

  update() {
    const { chart, series, box, candles, interval } = this.source;
    this.geometry = null;
    if (!chart || !series || !box || candles.length === 0) return;
    const coordOf = (time: number) => chart.timeScale().timeToCoordinate(time as Time);
    const x1 = timeToX(candles, interval, box.start, coordOf);
    const entryY = series.priceToCoordinate(box.entryPrice);
    if (x1 === null || entryY === null) return;

    // Width rule: < 5 min → fixed default width; otherwise the real duration (with a small floor).
    const realX2 = timeToX(candles, interval, box.end, coordOf);
    const x2 = box.short || realX2 === null ? x1 + SHORT_TRADE_WIDTH : Math.max(realX2, x1 + MIN_WIDTH);

    const stopY = box.stopLoss !== null ? series.priceToCoordinate(box.stopLoss) : null;
    const targetYs: { y: number; price: number }[] = [];
    for (const price of box.takeProfits) {
      const y = series.priceToCoordinate(price);
      if (y !== null) targetYs.push({ y, price });
    }
    const exitY = box.exitPrice !== null ? series.priceToCoordinate(box.exitPrice) : null;

    this.geometry = { x1, x2, entryY, stopY, targetYs, exit: exitY !== null ? { x: x2, y: exitY } : null };
  }

  zOrder() {
    return "bottom" as const;
  }

  renderer() {
    return new BoxRenderer(this.geometry, this.source.box);
  }
}

export class PositionBoxPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApiBase<Time> | null = null;
  series: ISeriesApi<SeriesType, Time> | null = null;
  private readonly views: BoxPaneView[];

  constructor(public box: PositionBox | null, public candles: Candle[], public interval: string) {
    this.views = [new BoxPaneView(this)];
  }

  attached({ chart, series }: SeriesAttachedParameter<Time, SeriesType>) {
    this.chart = chart;
    this.series = series;
  }

  detached() {
    this.chart = null;
    this.series = null;
  }

  updateAllViews() {
    this.views.forEach((v) => v.update());
  }

  paneViews() {
    return this.views;
  }
}
