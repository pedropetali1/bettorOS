import { BankrollForm } from "@/components/bankroll-form";

export default function NewBankrollPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New Bankroll</h1>
        <p className="text-sm text-muted-foreground">
          Add a bankroll to track balances and performance.
        </p>
      </div>
      <BankrollForm />
    </div>
  );
}
