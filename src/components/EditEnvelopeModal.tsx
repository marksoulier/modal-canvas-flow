
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { usePlan } from '../contexts/PlanContext';

interface EditEnvelopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  envelope?: {
    name: string;
    category: string;
    growth: string;
    rate: number;
    days_of_usefulness?: number;
    account_type: string;
  } | null;
  onSave: (envelope: { name: string; category: string; growth: string; rate: number; days_of_usefulness?: number; account_type: string }) => void;
}

const EditEnvelopeModal: React.FC<EditEnvelopeModalProps> = ({ isOpen, onClose, envelope = null, onSave }) => {
  const [name, setName] = useState(envelope?.name || '');
  const [category, setCategory] = useState(envelope?.category || '');
  const [growth, setGrowth] = useState(envelope?.growth || 'None');
  const [rate, setRate] = useState(envelope ? envelope.rate * 100 : 0);
  const [rateInputValue, setRateInputValue] = useState(envelope ? (envelope.rate * 100).toString() : '0');
  const [daysOfUsefulness, setDaysOfUsefulness] = useState(envelope?.days_of_usefulness || 0);
  const [rateError, setRateError] = useState<string>('');

  const { schema } = usePlan();

  React.useEffect(() => {
    setName(envelope?.name || '');
    setCategory(envelope?.category || '');
    setGrowth(envelope?.growth || 'None');
    const initialRate = envelope ? envelope.rate * 100 : 0;
    setRate(initialRate);
    setRateInputValue(initialRate.toString());
    setDaysOfUsefulness(envelope?.days_of_usefulness || 0);
    setRateError('');
  }, [envelope, isOpen]);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRateInputValue(value);
    setRateError(''); // Clear error when user starts typing
  };

  const handleRateBlur = () => {
    const numValue = parseFloat(rateInputValue) || 0;
    setRate(numValue);
  };

  const validateRate = (rateValue: number): { isValid: boolean; error?: string } => {
    if (rateValue < 0) {
      return { isValid: false, error: 'Rate cannot be less than 0%' };
    }
    if (rateValue > 40) {
      return { isValid: false, error: 'Rate cannot be greater than 40%' };
    }
    return { isValid: true };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category) return;

    // Validate rate before submitting
    const rateValidation = validateRate(rate);
    if (!rateValidation.isValid) {
      setRateError(rateValidation.error || '');
      return;
    }

    const payload: { name: string; category: string; growth: string; rate: number; days_of_usefulness?: number; account_type: string } = {
      name: name.trim(),
      category,
      growth,
      rate: rate / 100,
      account_type: envelope?.account_type || 'regular'
    };
    if (growth === 'Depreciation (Days)') {
      payload.days_of_usefulness = daysOfUsefulness;
    }
    onSave(payload);
    setName('');
    setCategory('');
    setGrowth('None');
    setRate(0);
    setRateInputValue('0');
    setDaysOfUsefulness(0);
    setRateError('');
    onClose();
  };

  const growthOptions = [
    { value: 'None', label: 'None' },
    { value: 'Appreciation', label: 'Appreciation' },
    { value: 'Daily Compound', label: 'Daily Compound' },
    { value: 'Monthly Compound', label: 'Monthly Compound' },
    { value: 'Yearly Compound', label: 'Yearly Compound' },
    { value: 'Depreciation', label: 'Depreciation (Rate)' },
    { value: 'Depreciation (Days)', label: 'Depreciation (Days)' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Envelope Details</DialogTitle>
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
                {schema?.categories.map((cat: string) => (
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

          {growth !== 'Depreciation (Days)' && (
            <div className="space-y-2">
              <Label htmlFor="rate">Growth Rate (%)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                max="40"
                value={rateInputValue}
                onChange={handleRateChange}
                onBlur={handleRateBlur}
                placeholder="0.00"
                disabled={growth === 'None'}
                className={rateError ? 'border-red-500' : ''}
              />
              {rateError && (
                <p className="text-xs text-red-500">{rateError}</p>
              )}
              <p className="text-xs text-gray-500">Rate must be between 0% and 40%</p>
            </div>
          )}

          {growth === 'Depreciation (Days)' && (
            <div className="space-y-2">
              <Label htmlFor="daysOfUsefulness">Days of Usefulness</Label>
              <Input
                id="daysOfUsefulness"
                type="number"
                min={1}
                value={daysOfUsefulness}
                onChange={(e) => setDaysOfUsefulness(Number(e.target.value))}
                placeholder="Enter number of days"
                required
              />
            </div>
          )}

          <div className="flex flex-col space-y-3 pt-4">
            <Button type="submit" className="w-full">
              Save Envelope
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

export default EditEnvelopeModal;
