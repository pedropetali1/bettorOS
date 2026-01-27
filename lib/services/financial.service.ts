"use server";

import { Prisma, type BetStatus, OperationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SettleOperationInput = {
  operationId: string;
  status: BetStatus;
  /**
   * Obrigatorio se o status for CASHED_OUT.
   * Opcional para WON em apostas simples.
   */
  actualReturn?: number;
  /**
   * CRITICO PARA ARBITRAGEM: ID da leg que venceu.
   * As outras serao marcadas automaticamente como LOST.
   */
  winningLegId?: string;
};

export async function settleOperation({
  operationId,
  status,
  actualReturn,
  winningLegId,
}: SettleOperationInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Busca Operacao e Legs
    const operation = await tx.operation.findUnique({
      where: { id: operationId },
      include: { legs: true },
    });

    if (!operation) throw new Error("Operation not found.");
    if (operation.legs.length === 0) throw new Error("Operation has no bets.");

    // 2. Calculo do Stake Total
    const totalStake = operation.legs.reduce(
      (acc, leg) => acc.add(leg.stake),
      new Prisma.Decimal(0)
    );

    let resolvedActualReturn = new Prisma.Decimal(0);

    // Array para armazenar o resultado individual de cada leg para processamento posterior
    const legResults: { legId: string; resultValue: Prisma.Decimal; status: BetStatus }[] = [];

    // 3. Logica de Distribuicao de Resultados
    if (status === "CASHED_OUT") {
      // Logica de Cashout Proporcional
      if (actualReturn === undefined || actualReturn < 0) {
        throw new Error("Actual return must be provided for cashout.");
      }
      const totalReturn = new Prisma.Decimal(actualReturn);
      resolvedActualReturn = totalReturn;

      operation.legs.forEach((leg) => {
        // Distribui o valor do cashout proporcionalmente ao stake de cada leg
        const legShare = totalStake.gt(0)
          ? totalReturn.mul(leg.stake).div(totalStake)
          : new Prisma.Decimal(0);

        legResults.push({ legId: leg.id, resultValue: legShare, status: "CASHED_OUT" });
      });
    } else if (status === "VOID") {
      // Anula tudo, devolve os stakes
      operation.legs.forEach((leg) => {
        legResults.push({ legId: leg.id, resultValue: leg.stake, status: "VOID" });
      });
      resolvedActualReturn = totalStake;
    } else if (status === "LOST") {
      // Perdeu tudo
      operation.legs.forEach((leg) => {
        legResults.push({ legId: leg.id, resultValue: new Prisma.Decimal(0), status: "LOST" });
      });
      resolvedActualReturn = new Prisma.Decimal(0);
    } else if (status === "WON") {
      // 4. Logica de Vitoria Condicional
      const isArbitrageOrMatched =
        operation.type === OperationType.ARBITRAGE ||
        operation.type === OperationType.MATCHED;

      if (isArbitrageOrMatched) {
        // CENARIO 1: Arbitragem/Matched (Vencedor Unico)
        if (!winningLegId) {
          throw new Error(
            "Para Arbitragem ou Matched Betting, voce deve especificar qual aposta venceu (winningLegId)."
          );
        }

        operation.legs.forEach((leg) => {
          if (leg.id === winningLegId) {
            const winValue = leg.stake.mul(leg.odds);
            legResults.push({ legId: leg.id, resultValue: winValue, status: "WON" });
            resolvedActualReturn = resolvedActualReturn.add(winValue);
          } else {
            // Se uma venceu na arb, as outras perderam
            legResults.push({ legId: leg.id, resultValue: new Prisma.Decimal(0), status: "LOST" });
          }
        });
      } else {
        // CENARIO 2: Simples ou Parlay (Todas vencem)
        operation.legs.forEach((leg) => {
          const winValue = leg.stake.mul(leg.odds);
          legResults.push({ legId: leg.id, resultValue: winValue, status: "WON" });
          resolvedActualReturn = resolvedActualReturn.add(winValue);
        });
      }
    }

    // 5. Atualizacao Atomica (Bankrolls e Bets) com calculo de Delta
    for (const res of legResults) {
      const leg = operation.legs.find((l) => l.id === res.legId)!;
      const oldResultValue = leg.resultValue ?? new Prisma.Decimal(0);
      const delta = res.resultValue.sub(oldResultValue);

      // So toca no banco se houver diferenca financeira ou mudanca de status
      if (!delta.equals(0) || leg.status !== res.status) {
        await tx.bet.update({
          where: { id: leg.id },
          data: {
            status: res.status,
            resultValue: res.resultValue,
          },
        });

        await tx.bankroll.update({
          where: { id: leg.bankrollId },
          data: {
            currentBalance: { increment: delta },
          },
        });
      }
    }

    // 6. Atualizacao da Operacao Pai
    const roi = totalStake.gt(0)
      ? resolvedActualReturn.sub(totalStake).div(totalStake)
      : new Prisma.Decimal(0);

    await tx.operation.update({
      where: { id: operationId },
      data: {
        status,
        totalStake,
        actualReturn: resolvedActualReturn,
        roi,
      },
    });

    return { ok: true };
  });
}
