"use client";

import { useState, useTransition } from "react";

import { deleteBet, updateBetStatus } from "@/app/actions/operation-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type BetActionsProps = {
  betId: string;
  stake: string;
  odds: string;
  status: string;
};

export function BetActions({ betId, stake, odds, status }: BetActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [cashoutOpen, setCashoutOpen] = useState(false);
  const [cashoutValue, setCashoutValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const runAction = (action: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      setFeedback(null);
      const result = await action();
      setFeedback(result.message);
    });
  };

  const handleStatus = (nextStatus: "WON" | "LOST" | "VOID") => {
    runAction(() => updateBetStatus({ betId, status: nextStatus }));
  };

  const handleCashout = () => {
    const value = Number(cashoutValue);
    runAction(() =>
      updateBetStatus({
        betId,
        status: "CASHED_OUT",
        resultValue: value,
      })
    );
    setCashoutOpen(false);
    setCashoutValue("");
  };

  const handleDelete = () => {
    runAction(() => deleteBet(betId));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending || status !== "PENDING"}
          onClick={() => handleStatus("WON")}
        >
          Win
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending || status !== "PENDING"}
          onClick={() => handleStatus("LOST")}
        >
          Lose
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending || status !== "PENDING"}
          onClick={() => handleStatus("VOID")}
        >
          Refund
        </Button>
        <Dialog open={cashoutOpen} onOpenChange={setCashoutOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={isPending}>
              Cashout / Stop loss
            </Button>
          </DialogTrigger>
          <DialogContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Cashout value</p>
              <p className="text-xs text-muted-foreground">
                Stake: {Number(stake).toFixed(2)} • Odds: {Number(odds).toFixed(2)}
              </p>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cashoutValue}
              onChange={(event) => setCashoutValue(event.target.value)}
              placeholder="Returned amount"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCashoutOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCashout}
                disabled={cashoutValue.length === 0 || isPending}
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </div>
      {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
    </div>
  );
}
