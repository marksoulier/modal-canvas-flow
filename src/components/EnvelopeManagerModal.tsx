
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { usePlan } from '../contexts/PlanContext';
import { Pencil, Trash2 } from 'lucide-react';

interface EnvelopeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EnvelopeManagerModal: React.FC<EnvelopeManagerModalProps> = ({ isOpen, onClose }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    growth: 'None',
    rate: 0
  });

  const { schema, plan, loadPlan } = usePlan();

  const startEditing = (index: number) => {
    const envelope = plan?.envelopes[index];
    if (envelope) {
      setEditForm({
        name: envelope.name,
        category: envelope.category,
        growth: envelope.growth,
        rate: envelope.rate * 100 // Convert decimal to percentage
      });
      setEditingIndex(index);
    }
  };

  const saveEdit = () => {
    if (!plan || editingIndex === null) return;

    const updatedEnvelopes = [...plan.envelopes];
    updatedEnvelopes[editingIndex] = {
      ...updatedEnvelopes[editingIndex],
      name: editForm.name.trim(),
      category: editForm.category,
      growth: editForm.growth,
      rate: editForm.rate / 100 // Convert percentage to decimal
    };

    const updatedPlan = {
      ...plan,
      envelopes: updatedEnvelopes
    };

    loadPlan(updatedPlan);
    setEditingIndex(null);
  };

  const deleteEnvelope = (index: number) => {
    if (!plan) return;

    const updatedEnvelopes = plan.envelopes.filter((_, i) => i !== index);
    const updatedPlan = {
      ...plan,
      envelopes: updatedEnvelopes
    };

    loadPlan(updatedPlan);
  };

  const growthOptions = [
    { value: 'None', label: 'None' },
    { value: 'Appreciation', label: 'Appreciation' },
    { value: 'Daily Compound', label: 'Daily Compound' },
    { value: 'Yearly Compound', label: 'Yearly Compound' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Envelopes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {plan?.envelopes.map((envelope, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              {editingIndex === index ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor={`edit-name-${index}`}>Name</Label>
                    <Input
                      id={`edit-name-${index}`}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-category-${index}`}>Category</Label>
                    <Select value={editForm.category} onValueChange={(value) => setEditForm({ ...editForm, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {schema?.envelopes.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-growth-${index}`}>Growth Model</Label>
                    <Select value={editForm.growth} onValueChange={(value) => setEditForm({ ...editForm, growth: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {growthOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-rate-${index}`}>Growth Rate (%)</Label>
                    <Input
                      id={`edit-rate-${index}`}
                      type="number"
                      step="0.01"
                      value={editForm.rate}
                      onChange={(e) => setEditForm({ ...editForm, rate: Number(e.target.value) })}
                      disabled={editForm.growth === 'None'}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveEdit} size="sm">
                      Save
                    </Button>
                    <Button onClick={() => setEditingIndex(null)} variant="outline" size="sm">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{envelope.name}</h3>
                      <p className="text-sm text-gray-600">Category: {envelope.category}</p>
                      <p className="text-sm text-gray-600">Growth: {envelope.growth}</p>
                      {envelope.growth !== 'None' && (
                        <p className="text-sm text-gray-600">Rate: {(envelope.rate * 100).toFixed(2)}%</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => startEditing(index)} size="sm" variant="outline">
                        <Pencil size={16} />
                      </Button>
                      <Button onClick={() => deleteEnvelope(index)} size="sm" variant="destructive">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {plan?.envelopes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No envelopes found. Add your first envelope to get started.
            </div>
          )}
        </div>

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
