import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft, ArrowDownRight } from 'lucide-react';
import { formatTime } from '../utils/dateUtils';

interface Transaction {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
  description: string;
  date: {
    seconds: number;
    nanoseconds: number;
  };
  type: 'income' | 'expense';
  categoryId: string;
}

export const Feed: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      orderBy('date', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const transactionsMap = new Map<string, Transaction>();
      
      querySnapshot.docs.forEach(doc => {
        const data = doc.data() as Transaction;
        
        // Создаем уникальный ключ, включающий все важные поля
        const key = `${data.fromUser}-${data.toUser}-${data.amount}-${data.date.seconds}-${data.description}`;
        
        // Для каждой пары транзакций оставляем только расход
        if (data.type === 'expense' || !transactionsMap.has(key)) {
          transactionsMap.set(key, {
            id: doc.id,
            ...data
          });
        }
      });

      // Преобразуем Map в массив и сортируем по дате
      const sortedTransactions = Array.from(transactionsMap.values())
        .sort((a, b) => b.date.seconds - a.date.seconds)
        // Фильтруем, оставляя только транзакции с типом 'expense'
        .filter(t => t.type === 'expense');
      
      setTransactions(sortedTransactions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp: { seconds: number; nanoseconds: number }) => {
    const date = new Date(timestamp.seconds * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'СЕГОДНЯ';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'ВЧЕРА';
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long'
      }).toUpperCase();
    }
  };

  const groupTransactionsByDate = () => {
    const grouped: { [key: string]: { transactions: Transaction[], total: number } } = {};
    transactions.forEach(transaction => {
      const dateKey = formatDate(transaction.date);
      if (!grouped[dateKey]) {
        grouped[dateKey] = { transactions: [], total: 0 };
      }
      grouped[dateKey].transactions.push(transaction);
      grouped[dateKey].total += Math.abs(transaction.amount);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const groupedTransactions = groupTransactionsByDate();

  return (
    <div className="max-w-3xl mx-auto bg-gray-100 min-h-screen">
      <div className="bg-white border-b px-4 sm:px-6 py-3 flex items-center sticky top-0 z-10">
        <button onClick={() => window.history.back()} className="mr-4">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">Лента</h1>
      </div>

      <div className="divide-y divide-gray-200">
        {Object.entries(groupedTransactions).map(([date, { transactions: dayTransactions, total }]) => (
          <div key={date}>
            <div className="bg-gray-50 px-4 py-2">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-gray-500">{date}</h2>
                <span className="text-sm font-medium text-gray-900">
                  {total.toLocaleString()} ₸
                </span>
              </div>
            </div>
            <div className="bg-white">
              {dayTransactions.map((transaction) => (
                <div key={transaction.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">
                        <ArrowDownRight className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{transaction.fromUser}</span>
                        <span className="text-sm text-gray-500 mt-1">{transaction.toUser}</span>
                        <span className="text-xs text-gray-400 mt-1">
                          {formatTime(transaction.date)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-medium text-base text-red-600">
                        -{Math.abs(transaction.amount).toLocaleString()} ₸
                      </span>
                      <span className="text-sm text-gray-500 mt-1 text-right">
                        {transaction.description}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2 bg-gray-50 border-t">
                <div className="flex justify-end">
                  <span className="text-sm font-medium text-gray-500">
                    Итого за день: {total.toLocaleString()} ₸
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && transactions.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <ArrowDownRight className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">История операций пуста</h3>
          <p className="text-gray-500">Здесь будут отображаться все операции</p>
        </div>
      )}
    </div>
  );
};