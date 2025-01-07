import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product } from '../../types/warehouse';
import { format, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useSwipeable } from 'react-swipeable';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';
import { PasswordPrompt } from '../PasswordPrompt';

interface Movement {
  id: string;
  type: 'in' | 'out';
  quantity: number;
  price: number;
  totalPrice: number;
  date: any;
  description: string;
  warehouse: string;
  previousQuantity: number;
  newQuantity: number;
  previousAveragePrice: number;
  newAveragePrice: number;
  supplier?: string;
}

interface ProductHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export const ProductHistory: React.FC<ProductHistoryProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [swipedMovementId, setSwipedMovementId] = useState<string | null>(null);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (swipedMovementId) {
        const target = e.target as HTMLElement;
        const swipedElement = document.querySelector(`[data-movement-id="${swipedMovementId}"]`);
        if (swipedElement && !swipedElement.contains(target)) {
          setSwipedMovementId(null);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [swipedMovementId]);

  const handlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      const element = eventData.event.target as HTMLElement;
      const movementElement = element.closest('[data-movement-id]');
      if (movementElement) {
        const movementId = movementElement.getAttribute('data-movement-id');
        if (movementId) {
          setSwipedMovementId(movementId === swipedMovementId ? null : movementId);
        }
      }
    },
    onSwipedRight: (eventData) => {
      const element = eventData.event.target as HTMLElement;
      const movementElement = element.closest('[data-movement-id]');
      if (movementElement) {
        const movementId = movementElement.getAttribute('data-movement-id');
        if (movementId) {
          setSwipedMovementId(null);
        }
      }
    },
    trackMouse: true,
    delta: 10
  });

  useEffect(() => {
    const q = query(
      collection(db, 'productMovements'),
      where('productId', '==', product.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const movementsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date
        })) as Movement[];
        
        // Calculate running totals
        let runningQuantity = 0;
        let runningValue = 0;
        
        movementsData.forEach(movement => {
          if (movement.type === 'in') {
            runningQuantity += movement.quantity;
            runningValue += movement.quantity * movement.price;
          } else {
            runningQuantity -= movement.quantity;
            // For outgoing movements, use the current average price
            runningValue -= movement.quantity * (runningValue / runningQuantity);
          }
        });
        
        setTotalQuantity(runningQuantity);
        setTotalValue(runningValue);
        
        // Сортируем локально, так как составной индекс может быть недоступен
        movementsData.sort((a, b) => {
          const dateA = a.date?.seconds || 0;
          const dateB = b.date?.seconds || 0;
          return dateB - dateA;
        });
        
        setMovements(movementsData);
      } catch (error) {
        console.error('Error processing movements:', error);
        setMovements([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error in movements subscription:', error);
      setMovements([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [product.id]);

  if (!isOpen) return null;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    if (!isValid(date)) return '';
    try {
      return format(date, 'd MMMM yyyy, HH:mm', { locale: ru });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const formatAmount = (amount: number) => {
    if (typeof amount !== 'number') return '0 ₸';
    return Math.round(amount).toLocaleString('ru-RU') + ' ₸';
  };

  const handleDelete = async (isAuthenticated: boolean) => {
    if (!isAuthenticated || !selectedMovement) {
      setShowPasswordPrompt(false);
      setSelectedMovement(null);
      return;
    }

    try {
      const batch = writeBatch(db);
      
      // Обновляем количество товара
      const productRef = doc(db, 'products', product.id);
      const newQuantity = selectedMovement.type === 'in' 
        ? selectedMovement.previousQuantity // Возвращаем предыдущее количество при удалении прихода
        : selectedMovement.previousQuantity; // Возвращаем предыдущее количество при удалении расхода

      batch.update(productRef, {
        quantity: newQuantity,
        averagePurchasePrice: selectedMovement.previousAveragePrice
      });

      // Удаляем запись о движении
      const movementRef = doc(db, 'productMovements', selectedMovement.id);
      batch.delete(movementRef);

      await batch.commit();
      showSuccessNotification('Операция успешно удалена');
    } catch (error) {
      console.error('Error deleting movement:', error);
      showErrorNotification('Ошибка при удалении операции');
    } finally {
      setShowPasswordPrompt(false);
      setSelectedMovement(null);
      setSwipedMovementId(null);
    }
  };

  const handleDeleteClick = (movement: Movement) => {
    setSelectedMovement(movement);
    setShowPasswordPrompt(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4" style={{ maxHeight: '90vh' }}>
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold">{product.name}</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 ml-2">
              <p className="text-xs sm:text-sm text-gray-500">История операций</p>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full self-start sm:self-auto">
                Склад {product.warehouse}
              </span>
            </div>
            <div className="hidden sm:block ml-auto text-right">
              <p className="text-xs sm:text-sm text-gray-600">Текущий остаток: {totalQuantity} {product.unit}</p>
              <p className="text-xs sm:text-sm text-emerald-600">
                Средняя цена: {totalQuantity > 0 ? Math.round(totalValue / totalQuantity).toLocaleString() : 0} ₸
              </p>
            </div>
          </div>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 85px)' }}>
          <div className="mb-6">
            <h3 className="font-medium text-gray-900">{product.name}</h3>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500">Текущий остаток</p>
                <p className="text-base sm:text-lg font-medium text-gray-900">{product.quantity} {product.unit}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500">Средняя цена</p>
                <p className="text-base sm:text-lg font-medium text-gray-900">{formatAmount(product.averagePurchasePrice || 0)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-500">Общая стоимость</p>
                <p className="text-base sm:text-lg font-medium text-gray-900">{formatAmount((product.quantity || 0) * (product.averagePurchasePrice || 0))}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              История операций пуста
            </div>
          ) : (
            <div className="space-y-4" {...handlers}>
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  data-movement-id={movement.id}
                  className="relative overflow-hidden"
                >
                  <div
                    className={`absolute inset-y-0 right-0 w-16 bg-red-500 flex items-center justify-center transition-opacity duration-200 ${
                      swipedMovementId === movement.id ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <button
                      onClick={() => handleDeleteClick(movement)}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <Trash2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  <div
                    className={`bg-white border rounded-lg p-4 hover:shadow-sm transition-all transform ${
                      swipedMovementId === movement.id ? '-translate-x-16' : 'translate-x-0'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-2 lg:gap-4">
                    <div className="w-full lg:w-auto">
                      <p className="text-sm sm:text-base font-medium text-gray-900">
                        {movement.type === 'in' ? 'Приход' : 'Расход'}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        {movement.description}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-2">
                        Склад: {movement.warehouse}
                      </p>
                      {movement.supplier && (
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                          Поставщик: {movement.supplier}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {formatDate(movement.date)}
                      </p>
                    </div>
                    <div className="w-full lg:w-auto text-right flex-shrink-0 bg-gray-50 p-3 rounded-lg">
                      <p className={`text-sm sm:text-base font-medium ${
                        movement.type === 'in' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {movement.type === 'in' ? '+' : '-'} {movement.quantity} {product.unit}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {formatAmount(movement.price)} / {product.unit}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Итого: {formatAmount(movement.totalPrice)}
                      </p>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">Остаток:</p>
                        <p className="text-xs sm:text-sm font-medium">
                        {movement.previousQuantity} → {movement.newQuantity} {product.unit}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Средняя цена:</p>
                        <p className="text-xs sm:text-sm font-medium">
                        {formatAmount(movement.previousAveragePrice)} → {formatAmount(movement.newAveragePrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {showPasswordPrompt && (
        <PasswordPrompt
          isOpen={showPasswordPrompt}
          onClose={() => {
            setShowPasswordPrompt(false);
            setSelectedMovement(null);
          }}
          onSuccess={() => handleDelete(true)}
        />
      )}
    </div>
  );
};