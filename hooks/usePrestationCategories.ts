'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PrestationCategory {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface PrestationSubcategory {
  id: string;
  category_id: string;
  user_id: string | null;
  name: string;
  sort_order: number;
}

export function usePrestationCategories() {
  const [categories, setCategories] = useState<PrestationCategory[]>([]);
  const [subcategories, setSubcategories] = useState<PrestationSubcategory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const sb = createClient();
    setLoading(true);
    const [{ data: cats }, { data: subs }] = await Promise.all([
      sb.from('prestation_categories').select('*').order('sort_order').order('name'),
      sb.from('prestation_subcategories').select('*').order('sort_order').order('name'),
    ]);
    setCategories((cats || []) as PrestationCategory[]);
    setSubcategories((subs || []) as PrestationSubcategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const subcategoriesFor = useCallback(
    (categoryId: string | null) => categoryId ? subcategories.filter((s) => s.category_id === categoryId) : [],
    [subcategories],
  );

  return { categories, subcategories, subcategoriesFor, loading, reload };
}
