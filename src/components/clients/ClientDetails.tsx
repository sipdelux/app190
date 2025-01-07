import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Client, initialClientState } from '../../types/client';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ClientMainInfo } from './ClientMainInfo';
import { ClientPayments } from './ClientPayments';
import { ClientContracts } from './ClientContracts';
import { EstimateBlock } from './estimate/EstimateBlock';
import { FoundationEstimate } from './FoundationEstimate';
import { SipWallsEstimate } from './SipWallsEstimate';
import { FloorEstimate } from './FloorEstimate';
import { RoofEstimate } from './RoofEstimate';
import { PartitionEstimate } from './PartitionEstimate';
import { ConsumablesEstimate } from './ConsumablesEstimate';
import { AdditionalWorksEstimate } from './AdditionalWorksEstimate';
import { ReceiptCalculation } from './ReceiptCalculation';

interface ClientDetailsProps {
  client: Client;
  onSave: () => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
}

export const ClientDetails = forwardRef<any, ClientDetailsProps>(({ 
  client, 
  onSave,
  isEditing,
  setIsEditing
}, ref) => {
  const [formData, setFormData] = useState({
    ...initialClientState,
    ...client
  });
  const [loading, setLoading] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showContracts, setShowContracts] = useState(false);
  const [floors, setFloors] = useState('1');

  const clientRef = doc(db, 'clients', client.id);

  const handleSave = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);

      // Обновляем данные клиента
      batch.update(clientRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });

      // Находим и обновляем связанные категории
      const [projectsQuery, clientsQuery] = [
        query(
          collection(db, 'categories'),
          where('title', '==', `${client.lastName} ${client.firstName}`),
          where('row', '==', 3)
        ),
        query(
          collection(db, 'categories'),
          where('title', '==', `${client.lastName} ${client.firstName}`),
          where('row', '==', 1)
        )
      ];
      
      const [projectsSnapshot, clientsSnapshot] = await Promise.all([
        getDocs(projectsQuery),
        getDocs(clientsQuery)
      ]);

      // Обновляем названия категорий
      const newTitle = `${formData.lastName} ${formData.firstName}`;
      [...projectsSnapshot.docs, ...clientsSnapshot.docs].forEach(doc => {
        batch.update(doc.ref, { 
          title: newTitle,
          updatedAt: serverTimestamp()
        });
      });

      // Находим и обновляем все связанные транзакции
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('fromUser', '==', `${client.lastName} ${client.firstName}`)
      );
      
      const toUserTransactionsQuery = query(
        collection(db, 'transactions'),
        where('toUser', '==', `${client.lastName} ${client.firstName}`)
      );

      const [transactionsSnapshot, toUserTransactionsSnapshot] = await Promise.all([
        getDocs(transactionsQuery),
        getDocs(toUserTransactionsQuery)
      ]);

      // Обновляем fromUser в транзакциях
      transactionsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { 
          fromUser: newTitle,
          updatedAt: serverTimestamp()
        });
      });

      // Обновляем toUser в транзакциях
      toUserTransactionsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { 
          toUser: newTitle,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      setIsEditing(false);
      onSave();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Ошибка при сохранении данных клиента');
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    handleSave
  }), [handleSave]);

  const shouldShowFloorEstimate = floors !== '1';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <ClientMainInfo
          formData={formData}
          isEditing={isEditing}
          onChange={(e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
          }}
        />

        <div className="mt-6 space-y-4">
          <div>
            <button
              onClick={() => setShowPayments(!showPayments)}
              className="flex items-center text-gray-700 hover:text-gray-900"
            >
              {showPayments ? (
                <ChevronUp className="w-5 h-5 mr-1" />
              ) : (
                <ChevronDown className="w-5 h-5 mr-1" />
              )}
              Платежи
            </button>

            {showPayments && (
              <ClientPayments
                formData={formData}
                isEditing={isEditing}
                onChange={(e) => {
                  const { name, value } = e.target;
                  setFormData(prev => ({ ...prev, [name]: Number(value) }));
                }}
              />
            )}
          </div>

          <div>
            <button
              onClick={() => setShowContracts(!showContracts)}
              className="flex items-center text-gray-700 hover:text-gray-900"
            >
              {showContracts ? (
                <ChevronUp className="w-5 h-5 mr-1" />
              ) : (
                <ChevronDown className="w-5 h-5 mr-1" />
              )}
              Договоры
            </button>

            {showContracts && (
              <div className="mt-4">
                <ClientContracts clientId={client.id} />
              </div>
            )}
          </div>

          <EstimateBlock
            isEditing={isEditing}
            clientId={client.id}
            onFloorsChange={setFloors}
          />

          <FoundationEstimate
            isEditing={isEditing}
            clientId={client.id}
          />

          <SipWallsEstimate
            isEditing={isEditing}
            clientId={client.id}
          />

          {shouldShowFloorEstimate && (
            <FloorEstimate
              isEditing={isEditing}
              clientId={client.id}
            />
          )}

          <RoofEstimate
            isEditing={isEditing}
            clientId={client.id}
          />

          <PartitionEstimate
            isEditing={isEditing}
            clientId={client.id}
          />

          <ConsumablesEstimate
            isEditing={isEditing}
            clientId={client.id}
          />

          <AdditionalWorksEstimate
            isEditing={isEditing}
            clientId={client.id}
            floors={floors}
          />

          <ReceiptCalculation
            isEditing={isEditing}
            clientId={client.id}
          />
        </div>

        {isEditing && (
          <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});