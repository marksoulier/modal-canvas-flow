
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

import { usePlan } from '../contexts/PlanContext';
import { Pencil, Trash2 } from 'lucide-react';
interface EnvelopeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditEnvelope: (envelope: { name: string; category: string; growth: string; rate: number; account_type: string }) => void;
  onAddEnvelope?: () => void;
}

const EnvelopeManagerModal: React.FC<EnvelopeManagerModalProps> = ({ isOpen, onClose, onEditEnvelope, onAddEnvelope }) => {
  const { plan, loadPlan } = usePlan();

  const deleteEnvelope = (index: number) => {
    if (!plan) return;
    const updatedEnvelopes = plan.envelopes.filter((_, i) => i !== index);
    const updatedPlan = {
      ...plan,
      envelopes: updatedEnvelopes
    };
    loadPlan(updatedPlan);
  };

  // Check if an envelope is non-editable (Other envelope or non-regular account_type)
  const isNonEditableEnvelope = (envelope: any) => {
    return envelope.account_type !== 'regular' || envelope.name.startsWith('Other (');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Envelopes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {plan?.envelopes.map((envelope, index) => {
            // Display only the part inside parentheses for 'Other (X)' envelopes
            let displayName = envelope.name;
            const otherMatch = envelope.name.match(/^Other \((.+)\)$/i);
            if (otherMatch) {
              displayName = otherMatch[1];
            }

            const isNonEditable = isNonEditableEnvelope(envelope);

            return (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{displayName}</h3>
                    <p className="text-sm text-gray-600">Category: {envelope.category}</p>
                    <p className="text-sm text-gray-600">Growth: {envelope.growth}</p>
                    {envelope.growth !== 'None' && typeof envelope.rate === 'number' && (
                      <p className="text-sm text-gray-600">Rate: {(envelope.rate * 100).toFixed(2)}%</p>
                    )}
                    {isNonEditable && (
                      <p className="text-xs text-gray-500 mt-1">(Default Envelope)</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => onEditEnvelope({ ...envelope, rate: envelope.rate ?? 0 })} size="sm" variant="outline">
                      <Pencil size={16} />
                    </Button>
                    <Button
                      onClick={() => deleteEnvelope(index)}
                      size="sm"
                      variant="destructive"
                      disabled={isNonEditable}
                      className={isNonEditable ? "opacity-50 cursor-not-allowed" : ""}
                      title={isNonEditable ? "System envelopes cannot be deleted" : "Delete envelope"}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {plan?.envelopes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No envelopes found. Add your first envelope to get started.
            </div>
          )}
        </div>

        {onAddEnvelope && (
          <div className="flex justify-end pt-2">
            <Button onClick={onAddEnvelope} variant="secondary">
              Add Envelope
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnvelopeManagerModal;
