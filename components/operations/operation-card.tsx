"use client";

import { useMemo, useState, useTransition } from "react";
import { type BetStatus, type OperationType } from "@prisma/client";
import { MoreHorizontal } from "lucide-react";

import { deleteOperation, updateOperationDescription } from "@/app/actions/operation-actions";
import { BetActions } from "@/components/bet-actions";
import { SettleOperationDialog } from "@/components/settle-operation-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type OperationLeg = {
  id: string;
  selection: string;
  odds: string;
  stake: string;
  status: BetStatus;
  resultValue?: string | null;
  bankrollName: string;
};

type OperationSummary = {
  id: string;
  type: OperationType;
  status: BetStatus;
  totalStake: string;
  expectedReturn?: string | null;
  actualReturn?: string | null;
  description?: string | null;
  createdAt: string;
  legs: OperationLeg[];
};

type OperationCardProps = {
  operation: OperationSummary;
};

const statusStyles: Record<BetStatus, string> = {
  WON: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  LOST: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  VOID: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  CASHED_OUT: "border-blue-500/40 bg-blue-500/10 text-blue-200",
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-200",
};

export function OperationCard({ operation }: OperationCardProps) {
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [description, setDescription] = useState(operation.description ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const stake = Number(operation.totalStake);
  const returnValue = Number(operation.actualReturn ?? operation.expectedReturn ?? 0);
  const roi = stake > 0 ? ((returnValue - stake) / stake) * 100 : 0;
  const primaryLeg = operation.legs[0];
  const isArbitrage = operation.type === "ARBITRAGE";
  const isMultiLeg = operation.type !== "SIMPLE";

  const legList = useMemo(() => operation.legs, [operation.legs]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[operation.status]}`}
        >
          {operation.status}
        </span>
        <details
          className="relative ml-auto"
          open={menuOpen}
          onToggle={(event) => setMenuOpen((event.target as HTMLDetailsElement).open)}
        >
          <summary className="list-none [&::-webkit-details-marker]:hidden">
            <Button size="icon" variant="ghost" aria-label="Opcoes">
              <MoreHorizontal className="size-4" />
            </Button>
          </summary>
          <div className="absolute right-0 mt-2 w-36 rounded-md border bg-popover p-1 text-sm shadow-md">
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left hover:bg-muted"
              onClick={() => {
                setMenuOpen(false);
                setEditOpen(true);
              }}
            >
              Editar
            </button>
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left text-destructive hover:bg-muted"
              onClick={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
            >
              Deletar
            </button>
          </div>
        </details>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div>
          <p className="text-lg font-semibold">
            {isArbitrage ? "Arbitrage Strategy" : primaryLeg?.selection ?? "Operation"}
          </p>
          {primaryLeg ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border px-2 py-0.5">
                {primaryLeg.bankrollName}
              </span>
              <span className="rounded-full border px-2 py-0.5">
                Odds {Number(primaryLeg.odds).toFixed(2)}
              </span>
            </div>
          ) : null}
        </div>

        {isMultiLeg ? (
          <details className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Legs ({legList.length})
            </summary>
            <div className="mt-3 space-y-3">
              {legList.map((leg) => (
                <div key={leg.id} className="rounded-md border bg-background p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{leg.selection}</p>
                    <p className="text-xs text-muted-foreground">
                      {leg.bankrollName} • Odds {Number(leg.odds).toFixed(2)} • Stake{" "}
                      {Number(leg.stake).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {leg.status} • Result{" "}
                      {leg.resultValue ? Number(leg.resultValue).toFixed(2) : "—"}
                    </p>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <BetActions
                      betId={leg.id}
                      stake={leg.stake}
                      odds={leg.odds}
                      status={leg.status}
                    />
                  </div>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {primaryLeg?.bankrollName} • Odds {primaryLeg ? Number(primaryLeg.odds).toFixed(2) : "—"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 bg-muted/50 px-4 py-3 text-xs">
        <div>
          <p className="text-muted-foreground">Stake</p>
          <p className="font-semibold">{stake.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Retorno</p>
          <p className="font-semibold">{returnValue.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">ROI</p>
          <p className="font-semibold">{roi.toFixed(2)}%</p>
        </div>
      </div>

      <div className="px-4 py-3">
        <SettleOperationDialog operation={operation} triggerLabel="Settle" />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Operacao</DialogTitle>
            <DialogDescription>Atualize as observacoes desta operacao.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Descricao</label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Notas da operacao"
            />
            {message ? (
              <p className="text-xs text-muted-foreground">{message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                startTransition(async () => {
                  const result = await updateOperationDescription({
                    operationId: operation.id,
                    description,
                  });
                  setMessage(result.message);
                  if (result.ok) {
                    setEditOpen(false);
                  }
                });
              }}
              disabled={isPending}
            >
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir operacao</DialogTitle>
            <DialogDescription>
              Essa acao remove a operacao e ajusta os saldos envolvidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteOperation(operation.id);
                  setMessage(result.message);
                  if (result.ok) {
                    setDeleteOpen(false);
                  }
                });
              }}
              disabled={isPending}
            >
              {isPending ? "Excluindo..." : "Deletar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
