import type { FastifyInstance } from "fastify";
import { createWorker, PSM } from "tesseract.js";
import { Jimp, JimpMime } from "jimp";
import type { ParsedTradeScreenshot } from "@pipntick/shared";
import { getUserId } from "../lib/auth";

type ParseBody = { image?: string };

function normalizeSymbol(raw: string): string {
  const s = raw.replace(/\+$/, "").toUpperCase();
  return /^[A-Z]{6}$/.test(s) ? `${s.slice(0, 3)}/${s.slice(3)}` : s;
}

// OCR reads the card's arrow icon as any of these — most commonly an em dash, not "→" itself.
const SEP = "(?:→|->|–|—|-)";

function toIso(datePart: string): string {
  return datePart.replace(/\./g, "-").replace(" ", "T");
}

/**
 * Handles two broker screenshot layouts without needing to know which one it's looking at:
 *  - mobile "card": symbol/direction/lot header, then "entry [sep] exit" price pair adjacent
 *    to each other, P&L trailing that, then an "entry-time [sep] exit-time" line.
 *  - desktop history-table row: symbol/direction/lot header (with a ticket number between
 *    symbol and buy/sell), open price, then unrelated S/L and T/P columns, then close time,
 *    close price, and profit as separate columns.
 * OCR text ordering isn't guaranteed to match the visual layout, so every field is best-effort
 * and falls back to null — the caller pre-fills a form for the user to review, not auto-saves.
 */
export function parseTradeCardText(text: string): ParsedTradeScreenshot {
  const result: ParsedTradeScreenshot = {
    symbol: null,
    direction: null,
    entryPrice: null,
    exitPrice: null,
    lotSize: null,
    entryDateTime: null,
    exitDateTime: null,
    pnl: null,
    swap: null,
    commission: null,
  };

  // Symbol/direction/lot header. Tolerates an optional ticket/order number between the
  // symbol and buy/sell — present on desktop history-table rows, absent on the mobile card.
  const headerMatch = text.match(/([A-Za-z0-9]+)\+?\s+(?:#?\d+\s+)?(buy|sell)\s+([\d.]+)/i);
  let headerEnd = 0;
  if (headerMatch && headerMatch.index !== undefined) {
    result.symbol = normalizeSymbol(headerMatch[1]);
    result.direction = headerMatch[2].toLowerCase() === "buy" ? "long" : "short";
    const lot = Number(headerMatch[3]);
    result.lotSize = Number.isFinite(lot) ? lot : null;
    headerEnd = headerMatch.index + headerMatch[0].length;
  }

  // Entry price: the first true decimal (has a '.') after the header — skips integer
  // ticket/order numbers, which never carry a decimal point.
  let entryPriceEnd = -1;
  const entryPriceMatch = text.slice(headerEnd).match(/\d+\.\d+/);
  if (entryPriceMatch && entryPriceMatch.index !== undefined) {
    result.entryPrice = Number(entryPriceMatch[0]);
    entryPriceEnd = headerEnd + entryPriceMatch.index + entryPriceMatch[0].length;
  }

  // Card layout: exit price sits immediately after entry price, joined by an arrow/dash.
  let cardStyle = false;
  if (entryPriceEnd >= 0) {
    const tail = text.slice(entryPriceEnd, entryPriceEnd + 15);
    const adjacentMatch = tail.match(new RegExp(`^\\s*${SEP}\\s*(\\d+\\.\\d+)`));
    if (adjacentMatch) {
      result.exitPrice = Number(adjacentMatch[1]);
      cardStyle = true;
      const pnlStart = entryPriceEnd + adjacentMatch[0].length;
      const pnlMatch = text.slice(pnlStart, pnlStart + 60).match(/[+-]?\d+\.\d{2}/);
      if (pnlMatch) {
        const val = Number(pnlMatch[0]);
        if (val !== result.entryPrice && val !== result.exitPrice) result.pnl = val;
      }
    }
  }

  // All date/time tokens in the card — first is entry, second (if present) is exit.
  const dateTokens = [...text.matchAll(/\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}/g)];
  if (cardStyle) {
    // A single token here plausibly means an open position (no exit yet) — fine to trust.
    if (dateTokens[0]) result.entryDateTime = toIso(dateTokens[0][0]);
    if (dateTokens[1]) result.exitDateTime = toIso(dateTokens[1][0]);
  } else if (dateTokens.length >= 2) {
    // History-table rows are always closed trades, so a single recognized token here means
    // OCR dropped the other one — labeling it as either entry or exit would be a guess, and
    // a wrong timestamp is worse than a blank field the user notices and fills in themselves.
    result.entryDateTime = toIso(dateTokens[0][0]);
    result.exitDateTime = toIso(dateTokens[1][0]);

    // Table layout: no arrow between entry/exit price (other columns sit in between), so
    // anchor off the second timestamp instead — close price and profit follow it directly.
    if (dateTokens[1].index !== undefined) {
      const afterCloseTime = text.slice(dateTokens[1].index + dateTokens[1][0].length);
      const nums = [...afterCloseTime.matchAll(/[+-]?\d+\.\d+/g)];
      if (nums[0]) result.exitPrice = Number(nums[0][0]);
      if (nums[1]) result.pnl = Number(nums[1][0]);
    }
  }

  // Labeled, so position/layout-independent — works the same on both card and table formats.
  // A bare "-" (no digits) means the broker showed no value; leave as null rather than 0.
  const swapMatch = text.match(/swap:?\s*([+-]?\d+\.?\d*)/i);
  if (swapMatch) result.swap = Number(swapMatch[1]);
  const chargesMatch = text.match(/charges:?\s*([+-]?\d+\.?\d*)/i);
  if (chargesMatch) result.commission = Number(chargesMatch[1]);

  return result;
}

export async function screenshotRoutes(app: FastifyInstance) {
  app.post("/api/trades/parse-screenshot", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) return reply.code(401).send({ error: "Unauthorized" });

    const body = request.body as ParseBody;
    if (!body?.image) return reply.code(400).send({ error: "image is required" });

    const match = body.image.match(/^data:image\/[a-zA-Z+.-]+;base64,(.+)$/);
    if (!match) return reply.code(400).send({ error: "image must be a base64 data URL" });
    const buffer = Buffer.from(match[1], "base64");

    // Screenshots (especially cropped desktop table rows) often have small, dense text —
    // upscaling + greyscale + contrast substantially improves Tesseract's accuracy on that.
    const image = await Jimp.fromBuffer(buffer);
    image.scale(3).greyscale().contrast(0.3);
    const preprocessed = await image.getBuffer(JimpMime.png);

    const worker = await createWorker("eng");
    try {
      // Card layouts have scattered, disconnected text blocks (header, price row, date row,
      // label pairs) rather than flowing paragraphs — sparse-text mode is built for that,
      // unlike the default "automatic page segmentation" which tries to assemble paragraphs.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const { data } = await worker.recognize(preprocessed);
      request.log.info({ text: data.text }, "screenshot OCR raw text");
      return parseTradeCardText(data.text);
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: "Failed to read text from screenshot." });
    } finally {
      await worker.terminate();
    }
  });
}
