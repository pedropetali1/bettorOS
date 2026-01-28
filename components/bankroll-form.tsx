"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { createBankroll } from "@/app/actions/bankroll-actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  BankrollFormValues,
  bankrollSchema,
} from "@/lib/validations/bankroll";

const currencies = ["BRL", "USD", "EUR"];

type BankrollFormProps = {
  onSuccess?: () => void;
};

export function BankrollForm({ onSuccess }: BankrollFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<BankrollFormValues>({
    resolver: zodResolver(bankrollSchema),
    defaultValues: {
      bookmakerName: "",
      currency: "BRL",
      initialBalance: 0,
    },
  });

  const onSubmit = async (values: BankrollFormValues) => {
    setIsSubmitting(true);
    const result = await createBankroll(values);
    setIsSubmitting(false);

    if (result.ok) {
      form.reset({ bookmakerName: "", currency: "BRL", initialBalance: 0 });
      toast({ title: "Bankroll criada", description: result.message });
      onSuccess?.();
    } else {
      toast({
        variant: "destructive",
        title: "Não foi possível criar a bankroll",
        description: result.message,
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="bookmakerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bookmaker Name</FormLabel>
              <FormControl>
                <Input placeholder="Bet365" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="initialBalance"
            render={({ field }) => {
              const { value, ...fieldProps } = field;
              const safeValue =
                typeof value === "number" || typeof value === "string" ? value : "";
              return (
                <FormItem>
                  <FormLabel>Initial Balance</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...fieldProps}
                      value={safeValue}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Create Bankroll"}
        </Button>
      </form>
    </Form>
  );
}
