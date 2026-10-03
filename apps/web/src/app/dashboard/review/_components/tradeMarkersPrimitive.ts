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
import type { ChartMarker } from "../../../../lib/trade-review-utils";

// Custom-drawn entry/exit markers for the Trade Review chart. Lightweight Charts' built-in series
// markers can't be outlined or have their text styled separately (text always takes the marker
// color), which made them hard to read on dark candles — so this series primitive draws them on
// the chart canvas itself: an outlined arrow (entry) or dot (exit) at the trade's exact price, with
// a bold dark label outlined in white so it reads on any background. Entry labels sit left of the
// marker and exit labels right, so they don't collide when both land on the same candle.

type DrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];
type Placed = ChartMarker & { x: number; y: number };

const LABEL_FONT = "700 12px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const LABEL_FILL = "#0b1b33";
const LABEL_OUTLINE = "#ffffff";

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: "left" | "right") {
  ctx.font = LABEL_FONT;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = LABEL_OUTLINE;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = LABEL_FILL;
  ctx.fillText(text, x, y);
}

/** Arrow whose tip touches (x, y): pointing up (drawn below the price) or down (drawn above). */
function drawArrow(ctx: CanvasRenderingContext2D, m: Placed, up: boolean) {
  const dir = up ? 1 : -1; // +1: body extends downward from the tip
  const tipY = m.y + 2 * dir;
  const headW = 9; // half-width of the head
  const headH = 11;
  const shaftW = 4; // half-width of the shaft
  const shaftH = 11;
  ctx.beginPath();
  ctx.moveTo(m.x, tipY);
  ctx.lineTo(m.x + headW, tipY + headH * dir);
  ctx.lineTo(m.x + shaftW, tipY + headH * dir);
  ctx.lineTo(m.x + shaftW, tipY + (headH + shaftH) * dir);
  ctx.lineTo(m.x - shaftW, tipY + (headH + shaftH) * dir);
  ctx.lineTo(m.x - shaftW, tipY + headH * dir);
  ctx.lineTo(m.x - headW, tipY + headH * dir);
  ctx.closePath();
  ctx.fillStyle = m.fill;
  ctx.fill();
  ctx.lineWidth = 1.75;
  ctx.lineJoin = "round";
  ctx.strokeStyle = m.stroke;
  ctx.stroke();
  // Label beside the arrow body, vertically centered on it.
  drawLabel(ctx, m.label, m.x - headW - 6, tipY + ((headH + shaftH) / 2) * dir, "right");
}

function drawDot(ctx: CanvasRenderingContext2D, m: Placed) {
  ctx.beginPath();
  ctx.arc(m.x, m.y, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = m.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = m.stroke;
  ctx.stroke();
  drawLabel(ctx, m.label, m.x + 12, m.y, "left");
}

class MarkersRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly placed: Placed[]) {}

  draw(target: DrawTarget) {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const m of this.placed) {
        if (m.shape === "circle") drawDot(ctx, m);
        else drawArrow(ctx, m, m.shape === "arrowUp");
      }
    });
  }
}

class MarkersPaneView implements IPrimitivePaneView {
  private placed: Placed[] = [];
  constructor(private readonly source: TradeMarkersPrimitive) {}

  update() {
    const { chart, series } = this.source;
    if (!chart || !series) return;
    const timeScale = chart.timeScale();
    this.placed = [];
    for (const m of this.source.markers) {
      const x = timeScale.timeToCoordinate(m.time as Time);
      const y = series.priceToCoordinate(m.price);
      if (x !== null && y !== null) this.placed.push({ ...m, x, y });
    }
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return new MarkersRenderer(this.placed);
  }
}

export class TradeMarkersPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApiBase<Time> | null = null;
  series: ISeriesApi<SeriesType, Time> | null = null;
  private readonly views: MarkersPaneView[];

  constructor(public markers: ChartMarker[]) {
    this.views = [new MarkersPaneView(this)];
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
