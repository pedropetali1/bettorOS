"use client";

import { useRef, useState } from "react";

import { scanBetImage } from "@/app/actions/scanner-actions";
import { Button } from "@/components/ui/button";

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

type BetScannerProps = {
  onScanComplete: (data: ScanResult) => void;
};

export function BetScanner({ onScanComplete }: BetScannerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSelect = () => {
    inputRef.current?.click();
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("image", file);

    const result = await scanBetImage(formData);
    setIsLoading(false);

    if (!result.ok || !result.data) {
      setMessage(result.error ?? "Unable to analyze image.");
      return;
    }

    onScanComplete(result.data);
    setMessage("Scan complete. Fields filled.");
    event.target.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={handleSelect}
        disabled={isLoading}
      >
        {isLoading ? "Analyzing ticket..." : "Scan Bet Print"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
