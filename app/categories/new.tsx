import { Stack, router, useLocalSearchParams } from 'expo-router';
import CategoryForm from '../../components/CategoryForm';
import { addCategory } from '../../db';
import type { CategoryValues } from '../../components/CategoryForm';

export default function NewCategoryScreen() {
  const { parentId: parentIdParam } = useLocalSearchParams<{ parentId?: string }>();
  const parentId = parentIdParam ? Number(parentIdParam) : null;

  async function handleSave(values: CategoryValues) {
    await addCategory({ ...values, parent_id: parentId });
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <CategoryForm onSave={handleSave} onCancel={() => router.back()} />
    </>
  );
}
