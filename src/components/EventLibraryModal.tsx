
import React, { useState } from 'react';
import { X, Search, Calendar, Clock, MapPin, Users, Filter } from 'lucide-react';

interface EventLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EventLibraryModal: React.FC<EventLibraryModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const categories = [
    'All',
    'Income & Employment',
    'Living Expenses',
    'Major Purchases',
    'Investments & Assets',
    'Taxes & Government',
    'Life Events',
    'Health & Insurance',
    'System Events'
  ];

  const events = [
    // Income & Employment
    {
      id: '1',
      title: 'Get a Job',
      category: 'Income & Employment',
      parameters: 'salary, time_days, pay_period, federal_income_tax, state_income_tax, social_security_tax, medicare_tax, 401k_contribution, 401k_match',
      description: 'Start a new job with specified salary and benefits.',
      color: 'bg-green-500'
    },
    {
      id: '2',
      title: 'Get a Raise',
      category: 'Income & Employment',
      parameters: 'salary, time_days',
      description: 'Receive a salary increase at your current job.',
      color: 'bg-green-500'
    },
    {
      id: '3',
      title: 'Start a Business',
      category: 'Income & Employment',
      parameters: 'initial_investment, time_days, from_key',
      description: 'Launch your own business venture.',
      color: 'bg-green-500'
    },
    {
      id: '4',
      title: 'Side Gig Income',
      category: 'Income & Employment',
      parameters: 'monthly_income, start_time_days, duration_days',
      description: 'Generate additional income from side work.',
      color: 'bg-green-500'
    },
    {
      id: '5',
      title: 'Retirement',
      category: 'Income & Employment',
      parameters: 'time_days, from_key, withdrawal_schedule',
      description: 'Begin retirement and start withdrawing from retirement accounts.',
      color: 'bg-green-500'
    },

    // Living Expenses
    {
      id: '6',
      title: 'Buy Groceries',
      category: 'Living Expenses',
      parameters: 'monthly_amount, time_days, frequency_days, from_key',
      description: 'Regular grocery shopping expenses.',
      color: 'bg-orange-500'
    },
    {
      id: '7',
      title: 'Pay Utilities',
      category: 'Living Expenses',
      parameters: 'monthly_amount, time_days, frequency_days, from_key',
      description: 'Monthly utility bills (electricity, water, gas).',
      color: 'bg-orange-500'
    },
    {
      id: '8',
      title: 'Pay Rent',
      category: 'Living Expenses',
      parameters: 'amount, time_days, frequency_days, from_key',
      description: 'Monthly rental payments.',
      color: 'bg-orange-500'
    },
    {
      id: '9',
      title: 'Subscription Services',
      category: 'Living Expenses',
      parameters: 'monthly_total, time_days, from_key',
      description: 'Monthly subscription fees (streaming, software, etc.).',
      color: 'bg-orange-500'
    },

    // Major Purchases
    {
      id: '10',
      title: 'Buy a House',
      category: 'Major Purchases',
      parameters: 'home_value, loan_term_years, loan_rate, appreciation_rate, downpayment, time_days, property_tax_rate, property_tax_payment_frequency, property_tax_escrow',
      description: 'Purchase a home with mortgage financing.',
      color: 'bg-purple-500'
    },
    {
      id: '11',
      title: 'Buy a Car',
      category: 'Major Purchases',
      parameters: 'car_value, loan_term_years, loan_rate, downpayment, time_days, from_key',
      description: 'Purchase a vehicle with financing.',
      color: 'bg-purple-500'
    },
    {
      id: '12',
      title: 'Vacation',
      category: 'Major Purchases',
      parameters: 'total_cost, time_days, from_key, duration_days',
      description: 'Plan and budget for a vacation.',
      color: 'bg-purple-500'
    },

    // Investments & Assets
    {
      id: '13',
      title: 'High Yield Savings Account',
      category: 'Investments & Assets',
      parameters: 'interest_rate, time_days, amount, from_key, to_key',
      description: 'Open a high-yield savings account.',
      color: 'bg-blue-500'
    },
    {
      id: '14',
      title: 'Invest Money',
      category: 'Investments & Assets',
      parameters: 'amount, time_days, from_key, to_key, expected_return',
      description: 'Make an investment in stocks, bonds, or other assets.',
      color: 'bg-blue-500'
    },

    // Life Events
    {
      id: '15',
      title: 'Have a Kid',
      category: 'Life Events',
      parameters: 'initial_costs, time_days, from_key',
      description: 'Plan for the financial impact of having a child.',
      color: 'bg-pink-500'
    },
    {
      id: '16',
      title: 'Marriage',
      category: 'Life Events',
      parameters: 'cost, time_days, shared_income',
      description: 'Get married and combine finances.',
      color: 'bg-pink-500'
    },
    {
      id: '17',
      title: 'Move Cities or Countries',
      category: 'Life Events',
      parameters: 'moving_cost, change_in_rent, change_in_income, time_days',
      description: 'Relocate to a new city or country.',
      color: 'bg-pink-500'
    },

    // Health & Insurance
    {
      id: '18',
      title: 'Medical Expenses',
      category: 'Health & Insurance',
      parameters: 'total_cost, time_days, from_key, insurance_coverage, deductible',
      description: 'Unexpected medical costs.',
      color: 'bg-red-500'
    },
    {
      id: '19',
      title: 'Buy Life Insurance',
      category: 'Health & Insurance',
      parameters: 'coverage_amount, monthly_premium, term_years, time_days, from_key',
      description: 'Purchase life insurance coverage.',
      color: 'bg-red-500'
    },

    // Taxes & Government
    {
      id: '20',
      title: 'Pay Taxes',
      category: 'Taxes & Government',
      parameters: 'total_tax_due, time_days',
      description: 'Annual tax payment.',
      color: 'bg-yellow-500'
    },
    {
      id: '21',
      title: 'Receive Government Aid',
      category: 'Taxes & Government',
      parameters: 'benefit_type, amount, start_time_days',
      description: 'Receive government assistance or benefits.',
      color: 'bg-yellow-500'
    }
  ];

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div 
          className="bg-white rounded-xl shadow-xl max-w-6xl w-full h-[85vh] flex flex-col transform transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Financial Life Events Library</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="p-6 border-b border-gray-200 space-y-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Category Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex">
            {/* Event List */}
            <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
              <div className="p-4 space-y-3">
                {filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedEvent === event.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full ${event.color} mt-2 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{event.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{event.category}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Details */}
            <div className="w-1/2 p-6 overflow-y-auto">
              {selectedEvent ? (
                <div>
                  {(() => {
                    const event = events.find(e => e.id === selectedEvent);
                    if (!event) return null;
                    
                    return (
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-4 h-4 rounded-full ${event.color}`} />
                            <h3 className="text-2xl font-semibold text-gray-900">{event.title}</h3>
                          </div>
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                            {event.category}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                          <p className="text-gray-600 leading-relaxed">{event.description}</p>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Parameters</h4>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <code className="text-sm text-gray-700 break-words">
                              {event.parameters}
                            </code>
                          </div>
                        </div>

                        <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                          Add Event
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Select an event to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EventLibraryModal;
