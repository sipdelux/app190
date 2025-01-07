import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TopStatType } from '../types';

export const useStats = () => {
  const [stats, setStats] = useState<TopStatType[]>([
    { label: 'Баланс', value: '0 ₸' },
    { label: 'Расходы', value: '0 ₸' }
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Сначала получаем список ID категорий клиентов
      const loadClientCategories = async () => {
        const clientCategoriesQuery = query(
          collection(db, 'categories'),
          where('row', '==', 1)
        );
        const snapshot = await getDocs(clientCategoriesQuery);
        return snapshot.docs.map(doc => doc.id);
      };

      // Подписываемся на транзакции
      const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        try {
          const clientCategoryIds = await loadClientCategories();
          
          let totalBalance = 0;
          let totalExpenses = 0;

          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const amount = data.amount;
            const categoryId = data.categoryId;
            
            // Обновляем общий баланс системы
            if (categoryId === 'system_balance') {
              totalBalance += amount;
            }
            
            // Считаем расходы только если:
            // 1. Сумма отрицательная
            // 2. Категория не принадлежит клиенту
            // 3. Это не системная транзакция
            if (amount < 0 && 
                !clientCategoryIds.includes(categoryId) && 
                categoryId !== 'system_balance') {
              totalExpenses += Math.abs(amount);
            }
          });

          setStats([
            { label: 'Баланс', value: `${totalBalance.toLocaleString()} ₸` },
            { label: 'Расходы', value: `${totalExpenses.toLocaleString()} ₸` }
          ]);
          setLoading(false);
        } catch (error) {
          console.error('Ошибка при обработке транзакций:', error);
          setError(error instanceof Error ? error.message : 'Ошибка при обработке транзакций');
          setLoading(false);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Ошибка в useStats:', error);
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
      setLoading(false);
    }
  }, []);

  return { stats, loading, error };
};