import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const normalizeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

export const escapeCsvValue = (value: unknown) => {
  const normalized = normalizeCsvValue(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

export const toCsv = (headers: string[], rows: Array<Record<string, unknown>>) => {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const body = rows
    .map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","))
    .join("\n");
  return [headerLine, body].filter(Boolean).join("\n");
};
