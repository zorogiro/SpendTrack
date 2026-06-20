import { useEffect, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import ExpenseForm from '../../components/ExpenseForm';
import { getExpense } from '../../db';
import type { Expense } from '../../types';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    getExpense(Number(id)).then(row => {
      setExpense(row);
      setLoaded(true);
    });
  }, [id]);

  // Navigate away if the row doesn't exist (deleted from elsewhere, stale id, etc.)
  useEffect(() => {
    if (loaded && expense === null) router.back();
  }, [loaded, expense]);

  if (!loaded || expense === null) return null;

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <ExpenseForm
        initial={{
          id:          expense.id,
          amount:      expense.amount,
          currency:    expense.currency,
          category_id: expense.category_id,
          note:        expense.note,
          date:        expense.date,
        }}
        onSave={() => router.back()}
      />
    </>
  );
}
