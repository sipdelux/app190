import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product } from '../../types/product';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

interface DeleteProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  isOpen,
  onClose,
  product
}) => {
  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'products', product.id));
      showSuccessNotification('Товар успешно удален');
      onClose();
    } catch (error) {
      console.error('Error deleting product:', error);
      showErrorNotification('Ошибка при удалении товара');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-500 mr-2" />
            <h2 className="text-lg font-medium">Удаление товара</h2>
          </div>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Вы уверены, что хотите удалить товар "{product.name}"? Это действие нельзя будет отменить.
          </p>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};