import { KellyCalculator } from "@/components/kelly-calculator";

export default function KellyToolPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Kelly Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Easy way to size winning bets while limiting risk per operation.
        </p>
      </div>
      <KellyCalculator />
    </div>
  );
}
