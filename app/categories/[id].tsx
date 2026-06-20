import { useEffect, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import CategoryForm from '../../components/CategoryForm';
import { getCategoryById, updateCategory } from '../../db';
import type { CategoryValues } from '../../components/CategoryForm';
import type { Category } from '../../types';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cat, setCat]     = useState<Category | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCategoryById(Number(id)).then(row => { setCat(row); setLoaded(true); });
  }, [id]);

  // Navigate away if the row no longer exists
  useEffect(() => {
    if (loaded && cat === null) router.back();
  }, [loaded, cat]);

  if (!loaded || cat === null) return null;

  async function handleSave(values: CategoryValues) {
    await updateCategory(cat!.id, values);
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <CategoryForm
        initial={{
          id:             cat.id,
          name:           cat.name,
          icon:           cat.icon,
          color:          cat.color,
          monthly_budget: cat.monthly_budget,
          parent_id:      cat.parent_id,
        }}
        onSave={handleSave}
        onCancel={() => router.back()}
      />
    </>
  );
}
