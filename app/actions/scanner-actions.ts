"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

type ScanResult = {
  bookmakerName: string | null;
  matchName: string | null;
  selection: string | null;
  odds: number | null;
  stake: number | null;
  date: string | null;
  sport: string | null;
  league: string | null;
};

type ActionResult = { ok: boolean; data?: ScanResult | ScanResult[]; error?: string };

const extractJson = (text: string) => {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  return cleaned;
};

const normalizeEmpty = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const inferMatchName = (value: string | null) => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes(" vs ") || normalized.includes(" v ") || normalized.includes(" x ")) {
    return value.trim();
  }
  return null;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const toDateInput = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const enrichWithSportsDb = async (data: ScanResult): Promise<ScanResult> => {
  const apiKey = process.env.SPORTSDB_API_KEY;
  if (!apiKey) return data;

  const selection = data.matchName?.trim() || data.selection?.trim();
  const date = toDateInput(data.date);
  if (!selection || !date) return data;

  const sport = data.sport?.trim() || "Soccer";
  const baseUrl = process.env.SPORTSDB_BASE_URL ?? "https://www.thesportsdb.com/api/v1/json";
  const url = `${baseUrl}/${apiKey}/eventsday.php?d=${encodeURIComponent(
    date
  )}&s=${encodeURIComponent(sport)}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return data;
    const payload = (await response.json()) as {
      events?: Array<{
        strHomeTeam?: string | null;
        strAwayTeam?: string | null;
        strLeague?: string | null;
        strSport?: string | null;
        dateEvent?: string | null;
      }>;
    };

    const events = payload.events ?? [];
    const needle = normalize(selection);
    const match = events.find((event) => {
      const home = event.strHomeTeam ? normalize(event.strHomeTeam) : "";
      const away = event.strAwayTeam ? normalize(event.strAwayTeam) : "";
      return home.includes(needle) || away.includes(needle);
    });

    if (!match) return data;

    return {
      ...data,
      sport: data.sport ?? match.strSport ?? null,
      league: data.league ?? match.strLeague ?? null,
      date: data.date ?? match.dateEvent ?? null,
    };
  } catch {
    return data;
  }
};

export async function scanBetImage(formData: FormData): Promise<ActionResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "Missing GEMINI_API_KEY." };
  }

  const file = formData.get("image");

  if (!(file instanceof File)) {
    return { ok: false, error: "Image file not provided." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const prompt =
    "Extract betting slip data and return ONLY strict JSON with keys: " +
    "bookmakerName, matchName, selection, odds, stake, date, sport, league. " +
    "matchName must be only the teams/competitors (e.g. 'Lakers vs Celtics'). " +
    "selection must be only the bet pick/market (e.g. 'Over 2.5 Goals'). " +
    "If you cannot identify a field, return null. " +
    "Do not include markdown or extra text.";

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64,
                mimeType: file.type || "image/jpeg",
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const raw = result.response.text();
    console.log("[scanner] raw response:", raw);
    const jsonText = extractJson(raw);
    console.log("[scanner] json text:", jsonText);
    const parsed = JSON.parse(jsonText) as ScanResult | ScanResult[];
    console.log("[scanner] parsed json:", parsed);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const normalizedItems = items.map((item) => {
      const normalized: ScanResult = {
        bookmakerName: normalizeEmpty(item?.bookmakerName ?? null),
        matchName: normalizeEmpty(item?.matchName ?? null),
        selection: normalizeEmpty(item?.selection ?? null),
        odds: parseNumber(item?.odds ?? null),
        stake: parseNumber(item?.stake ?? null),
        date: normalizeEmpty(item?.date ?? null),
        sport: normalizeEmpty(item?.sport ?? null),
        league: normalizeEmpty(item?.league ?? null),
      };

      if (!normalized.matchName) {
        normalized.matchName = inferMatchName(normalized.selection);
        if (normalized.matchName) {
          normalized.selection = null;
        }
      }

      return normalized;
    });
    console.log("[scanner] normalized:", normalizedItems);

    const enriched = await enrichWithSportsDb(normalizedItems[0]);
    const enrichedItems = normalizedItems.map((item) => ({
      ...item,
      sport: item.sport ?? enriched.sport ?? null,
      league: item.league ?? enriched.league ?? null,
      date: item.date ?? enriched.date ?? null,
    }));

    return { ok: true, data: Array.isArray(parsed) ? enrichedItems : enrichedItems[0] };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Failed to scan bet image." };
  }
}
