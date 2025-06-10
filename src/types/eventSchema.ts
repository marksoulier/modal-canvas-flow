export interface EventParameter {
    type: string;
    description: string;
    default: number | string;
}

export interface UpdatingEvent {
    type: string;
    icon: string;
    description: string;
    parameters: EventParameter[];
}

export interface EventDefinition {
    type: string;
    category: string;
    description: string;
    icon: string;
    parameters: EventParameter[];
    updating_events?: UpdatingEvent[];
}

export interface EventSchema {
    current_time_days: number;
    inflation_rate: number;
    adjust_for_inflation: boolean;
    envelopes: string[];
    events: EventDefinition[];
}

// Map of Lucide icon names to schema icon names
export const iconMap: Record<string, string> = {
    'shopping-cart': 'ShoppingCart',
    'gift': 'Gift',
    'briefcase': 'Briefcase',
    'factory': 'Factory',
    'moon': 'Moon',
    'home': 'Home',
    'car': 'Car',
    'baby': 'Baby',
    'ring': 'Ring',
    'split': 'Split',
    'skull': 'Skull',
    'stethoscope': 'Stethoscope',
    'heart-pulse': 'HeartPulse',
    'hand-coins': 'HandCoins',
    'trending-up': 'TrendingUp',
    'banknote': 'Banknote',
    'file-text': 'FileText',
    'edit': 'Edit',
    'arrow-up': 'ArrowUp',
    'dollar-sign': 'DollarSign',
    'sliders-horizontal': 'SlidersHorizontal',
    'bar-chart': 'BarChart',
    'x-octagon': 'XOctagon',
    'clipboard-check': 'ClipboardCheck',
    'plus': 'Plus',
    'clock': 'Clock',
    'shield-check': 'ShieldCheck',
    'wind': 'Wind',
    'flame': 'Flame',
    'waves': 'Waves',
    'wrench': 'Wrench',
    'graduation-cap': 'GraduationCap',
    'plus-circle': 'PlusCircle',
    'badge-dollar-sign': 'BadgeDollarSign',
    'dollar-bill': 'DollarBill',
    'wallet': 'Wallet',
    'pencil': 'Pencil'
}; 