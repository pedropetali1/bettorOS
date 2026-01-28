"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BankrollForm } from "@/components/bankroll-form";
import { OperationForm } from "@/components/operations/operation-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getBankrolls } from "@/app/actions/bankroll-actions";
import { completeOnboarding } from "@/app/onboarding/actions";

type BankrollOption = {
  id: string;
  bookmakerName: string;
  currency: string;
  currentBalance: string;
};

type OnboardingWizardProps = {
  initialBankrolls: BankrollOption[];
};

const steps = [
  {
    title: "Bem-vindo ao BettorOS",
    description: "Vamos configurar sua conta com uma bankroll e sua primeira operação.",
  },
  {
    title: "Crie sua primeira bankroll",
    description: "Adicione o saldo inicial para começarmos a acompanhar seus resultados.",
  },
  {
    title: "Registre sua primeira operação",
    description: "Salve sua primeira aposta ou arbitragem para ver os relatórios.",
  },
];

export function OnboardingWizard({ initialBankrolls }: OnboardingWizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [bankrolls, setBankrolls] = useState<BankrollOption[]>(initialBankrolls);
  const [isCompleting, setIsCompleting] = useState(false);

  const refreshBankrolls = useCallback(async () => {
    const latest = await getBankrolls();
    setBankrolls(latest);
  }, []);

  const step = useMemo(() => steps[stepIndex] ?? steps[0], [stepIndex]);

  const handleBankrollSuccess = async () => {
    await refreshBankrolls();
    setStepIndex(2);
  };

  const handleOperationSuccess = async () => {
    setIsCompleting(true);
    const result = await completeOnboarding();
    setIsCompleting(false);

    if (result.ok) {
      toast({ title: "Onboarding concluído", description: result.message });
      router.push("/");
      router.refresh();
      return;
    }

    toast({
      variant: "destructive",
      title: "Não foi possível concluir",
      description: result.message,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stepIndex === 0 ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Em poucos passos você terá sua banca configurada e a primeira operação registrada
                para começar a acompanhar performance.
              </p>
              <Button onClick={() => setStepIndex(1)}>Começar onboarding</Button>
            </div>
          ) : null}

          {stepIndex === 1 ? (
            <div className="space-y-6">
              {bankrolls.length > 0 ? (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Você já tem bankrolls cadastradas. Pode continuar para registrar a primeira
                  operação.
                </div>
              ) : null}
              <BankrollForm onSuccess={handleBankrollSuccess} />
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStepIndex(0)}>
                  Voltar
                </Button>
                {bankrolls.length > 0 ? (
                  <Button onClick={() => setStepIndex(2)}>Continuar</Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {stepIndex === 2 ? (
            <div className="space-y-6">
              {bankrolls.length === 0 ? (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Crie uma bankroll antes de registrar a primeira operação.
                </div>
              ) : (
                <OperationForm bankrolls={bankrolls} onSuccess={handleOperationSuccess} />
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStepIndex(1)}>
                  Voltar
                </Button>
                <Button variant="outline" onClick={refreshBankrolls}>
                  Atualizar bankrolls
                </Button>
              </div>
              {isCompleting ? (
                <p className="text-xs text-muted-foreground">Finalizando onboarding...</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Passo {stepIndex + 1} de {steps.length}
        </span>
        <span>Você pode continuar depois no menu lateral.</span>
      </div>
    </div>
  );
}
