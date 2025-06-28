
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { usePlan } from '../contexts/PlanContext';

interface AddEnvelopeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddEnvelopeModal: React.FC<AddEnvelopeModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [growth, setGrowth] = useState('None');
  const [rate, setRate] = useState(0);
  
  const { schema, plan, loadPlan } = usePlan();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !category) {
      return;
    }

    if (!plan) return;

    const newEnvelope = {
      name: name.trim(),
      category,
      growth,
      rate: rate / 100 // Convert percentage to decimal
    };

    const updatedPlan = {
      ...plan,
      envelopes: [...plan.envelopes, newEnvelope]
    };

    loadPlan(updatedPlan);
    
    // Reset form
    setName('');
    setCategory('');
    setGrowth('None');
    setRate(0);
    
    onClose();
  };

  const growthOptions = [
    { value: 'None', label: 'None' },
    { value: 'Appreciation', label: 'Appreciation' },
    { value: 'Daily Compound', label: 'Daily Compound' },
    { value: 'Yearly Compound', label: 'Yearly Compound' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Envelope</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter envelope name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
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
            <Label htmlFor="growth">Growth Model</Label>
            <Select value={growth} onValueChange={setGrowth}>
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
            <Label htmlFor="rate">Growth Rate (%)</Label>
            <Input
              id="rate"
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              placeholder="0.00"
              disabled={growth === 'None'}
            />
          </div>

          <div className="flex flex-col space-y-3 pt-4">
            <Button type="submit" className="w-full">
              Add Envelope
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="w-full">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEnvelopeModal;
