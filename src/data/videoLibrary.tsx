import demoVideo from './demo-video.mp4';
import inflowVideo from './inflow-video.mp4';
import outflowVideo from './outflow-video.mp4';
import declareAccountsVideo from './declare-accounts.mp4';
import functionPartsVideo from './function-parts.mp4';
import updatingEventsVideo from './updating-events.mp4';
import reocurringEventVideo from './reocurring-event.mp4';
import houseVideo from './house.mp4';
import negativeMoneyVideo from './negitive-money.mp4';
import lifeEventVideo from './life-event.mp4';
import cdEnvelopeVideo from './cd-envelope.mp4';
import carVideo from './car.mp4';
import loanVideo from './loan.mp4';
import transferVideo from './transfer.mp4';
import inflationVideo from './inflation.mp4';
import gap5912Video from './59_12_gap.mp4';
import comparePlansVideo from './compare_plans.mp4';


export interface VideoItem {
    id: string;
    title: string;
    description: string; // Markdown content
    videoSrc: string;
    category: string;
    duration?: string;
    tags?: string[];
}

export interface VideoCategory {
    id: string;
    name: string;
    description: string;
}

// Video categories
export const videoCategories: VideoCategory[] = [
    {
        id: 'getting-started',
        name: 'Getting Started',
        description: 'Basic tutorials to get you up and running'
    },
    {
        id: 'advanced',
        name: 'Advanced Features',
        description: 'Deep dive into powerful features'
    },
    {
        id: 'troubleshooting',
        name: 'Troubleshooting',
        description: 'Common issues and solutions'
    }
];

// Video library - starting with 2 videos for demonstration
export const videoLibrary: VideoItem[] = [
    {
        id: 'app-demo',
        title: 'Application Demo',
        category: 'getting-started',
        videoSrc: demoVideo,
        duration: '3:45',
        description: `# Application Overview

This demo shows the key features of the application:

## What You'll Learn
- Adding events to your timeline
- Managing envelopes and budgets  
- Navigating the visualization
- Using the planning tools

## Getting Started
1. **Create your first event** - Click the "+" button to add timeline events
2. **Set up envelopes** - Organize your budget categories
3. **Explore the timeline** - Use zoom and pan to navigate
4. **Plan ahead** - Use forecasting tools to see future scenarios

> **Tip**: Start with the basics and gradually explore advanced features as you become comfortable with the interface.`,
        tags: ['overview', 'basics', 'tutorial']
    },
    {
        id: 'inflation',
        title: 'Inflation',
        category: 'getting-started',
        videoSrc: inflationVideo,
        duration: '2:15',
        description: `# Inflation Basics

Understand how inflation impacts your plan and how to use the **Adjust for inflation** setting.

When turning on **Adjust for inflation**, what is happening is all values on the plan are being converted to todays purchasing power.
So values in the future will be less as they will be worth less in todays dollars.

Example:
A loaf of bread bought in 2025 for $4.00 will be purchased in 2060 for $10.33 with a 2.4% inflation rate.


## Key Points
- Inflation reduces the purchasing power of money over time
- Enable the toggle if you want values to be interpreted in today's dollars
- Set an inflation rate that reflects your assumptions (e.g. 2–3%), you can adjust this in the plan preferences`,
        tags: ['inflation', 'basics', 'settings']
    },
    {
        id: 'inflow-events',
        title: 'Inflow Events',
        category: 'getting-started',
        videoSrc: inflowVideo,
        duration: '2:30',
        description: `# Understanding Inflow Events

Learn how money enters your financial system:

## What is an Inflow Event?
An inflow event occurs when money comes into your system:

- **Finding money** - You find $20 on the ground and put it in your wallet
- **Selling items** - You sell your table for $200
- **Income sources** - Salary, bonuses, gifts, or any money coming in

At its most basic level, an inflow event is money entering an "envelope" which is an account you can use to track money. This might be your wallet, your 401K, or any other financial account.

## Key Points
- Inflow events represent money entering your system
- They can be one-time or recurring
- Each inflow must be assigned to a specific envelope
- Track all income sources, not just regular salary`,
        tags: ['basics', 'inflow', 'income', 'money-management']
    },
    {
        id: '59_12_gap',
        title: 'Age 59½ Net Worth Jump',
        category: 'advanced',
        videoSrc: gap5912Video,
        duration: '1:40',
        description: `# Why Net Worth Jumps at Age 59½

At age **59½**, withdrawals from many tax-advantaged retirement accounts (like 401(k) and IRA) no longer incur the early-withdrawal penalty.

## What This Means
- Before 59½: withdrawing may incur penalties in addition to taxes
- After 59½: penalties are removed, which effectively increases accessible value

## In the Visualization
- You may see a noticeable jump in accessible net worth around this age
- This is a modeling cue to help explain retirement account liquidity milestones`,
        tags: ['retirement', '59-1/2', 'advanced']
    },
    {
        id: 'compare-plans',
        title: 'Compare Mode',
        category: 'advanced',
        videoSrc: comparePlansVideo,
        duration: '1:50',
        description: `# Compare Mode

Use Compare Mode to visualize your current plan against a compared snapshot.

## How It Works
- Toggle **Compare** near the plan title
- When enabled, your current plan is copied into a compared plan
- A gray line shows the compared plan's net worth for side-by-side comparison
- Events on the compared plan are not editable but shown as outlines
- To edit the compared plan use the swap control in top left to switch it to the main plan
- To copy the existing plan to the compared plan then click the copy button in top left

The difference between the two plans is shown in the legend as the current plan minus the compared plan.
A green number means the current plan is greater than the compared plan, a red number means the compared plan is greater than the current plan.

## Tips
- Make edits while Compare is on to see the impact vs. the snapshot
- Use the copy and swap controls to manage the locked plan
- Turn Compare off to focus on a single plan view`,
        tags: ['compare', 'advanced', 'analysis']
    },
    {
        id: 'outflow-events',
        title: 'Outflow Events',
        category: 'getting-started',
        videoSrc: outflowVideo,
        duration: '2:45',
        description: `# Outflow Events

Outflow events are one of the basic events that remove money from an envelope.

## What is an Outflow Event?
An outflow event occurs when money leaves your system:

- **Daily expenses** - $10 spent on lunch
- **Bills and payments** - Rent, utilities, subscriptions
- **Large purchases** - Electronics, furniture, services

## Key Points
- Outflow events represent money leaving your system
- They can be one-time or recurring expenses
- Each outflow must be assigned to a specific envelope
- Track all spending, including small daily expenses
- Outflows reduce the balance in the specified envelope`,
        tags: ['basics', 'outflow', 'expenses', 'spending', 'money-management']
    },
    {
        id: 'declare-accounts',
        title: 'Declare Accounts',
        category: 'getting-started',
        videoSrc: declareAccountsVideo,
        duration: '2:00',
        description: `# Declare Accounts

Declare accounts is an event that can be used to set the actual value in an account on a given day.

## How It Works
- Sets the exact balance of an envelope at a specific date
- Disregards the effect of previous events' growth
- For example: If a CD account was growing at 4% per year and started a month before the declare account, the simulator will start with the declared value and continue growth from there

## Important Notes
- For debt category envelopes, set to a negative number representing that debt
- Use this event on today's date to set a baseline for your net worth accounts
- If you have more than 5 envelopes, use multiple declare accounts events

## Common Use Cases
- Setting current account balances as a starting point
- Correcting discrepancies between simulated and actual balances
- Establishing baseline values for new accounts`,
        tags: ['accounts', 'setup', 'basics']
    },
    {
        id: 'function-parts',
        title: 'Function Parts',
        category: 'advanced',
        videoSrc: functionPartsVideo,
        duration: '2:10',
        description: `# Function Parts

More advanced events that you'll encounter later are just combinations of basic events.

## How They Work
- For example, the transfer event is a combination of inflow and outflow events
- You can toggle each functional part of the event on or off to see its effect
- This allows you to understand the individual components of complex events

## Advanced Usage
- Use this feature to increase or decrease granularity of the simulation
- Helps understand the underlying mechanics of complex financial events
- Useful for debugging and understanding event interactions

## Key Benefits
- Better understanding of how complex events work
- Ability to isolate specific effects within compound events
- Enhanced control over simulation detail level`,
        tags: ['functions', 'advanced', 'features']
    },
    {
        id: 'updating-events',
        title: 'Updating Events',
        category: 'getting-started',
        videoSrc: updatingEventsVideo,
        duration: '2:25',
        description: `# Updating Events

An updating event is used to modify parameters set in an event over time.

## When to Use
- Used when an event is recurring but parameters change
- For example, a pay increase at a specific date will simulate using the set amount recurring up until that time, then use the new amount

## Example Scenario
This example shows a $2000 inflow of cash every month, but at age 30 increases to $3000 inflow of cash.

## Key Points
- Updates affect all future occurrences of the event
- Previous events remain unchanged
- Useful for modeling salary increases, expense changes, or rate adjustments
- Can be applied to any recurring event type`,
        tags: ['events', 'editing', 'management']
    },
    {
        id: 'reocurring-event',
        title: 'Recurring Events',
        category: 'advanced',
        videoSrc: reocurringEventVideo,
        duration: '1:35',
        description: `# Recurring Events

Use recurring events to simulate an event that happens repeatedly over time.

## Common Examples
- Monthly inflow of money into a cash envelope
- Regular bill payments
- Periodic transfers between accounts
- Recurring expenses or income

## Example Scenario
This example shows a $2000 inflow of cash every month, but at age 30 increases to $3000 inflow of cash.

## Key Benefits
- Automates repetitive financial events
- Reduces manual event creation
- Ensures consistency in recurring transactions
- Simplifies long-term financial planning`,
        tags: ['recurring', 'automation', 'advanced']
    },
    {
        id: 'house',
        title: 'House',
        category: 'advanced',
        videoSrc: houseVideo,
        duration: '4:30',
        description: `# House

Use a house event to simulate a house purchase.

## How It Works
The house event shows a house being purchased. The cash envelope becomes negative because the house event simulates monthly payments from cash to pay off the home mortgage. With no income to cash, the cash envelope goes negative to pay the down payment and the mortgage.

## Important Settings
- **Debt Rate**: Set to the home loan rate (monthly interest rate)
- **Home Appreciation Rate**: Set appropriate for your area
- **Property Tax Rate**: Set appropriate for your area

## Key Points
- The house event follows an amortization schedule based on monthly compounding debt
- Do not change the debt growth rate to another growth rate
- The event automatically handles down payment, mortgage payments, and property taxes
- House value appreciation is tracked separately from the debt`,
        tags: ['house', 'property', 'advanced']
    },
    {
        id: 'negative-money',
        title: 'Negative Money',
        category: 'troubleshooting',
        videoSrc: negativeMoneyVideo,
        duration: '1:25',
        description: `# Negative Money

The simulation will show an error at the top if a non-debt account goes negative.

## What This Means
This indicates that at some point in time you have spent all the money in a specific account and either need to:
- Transfer money into it from another account
- Have an inflow into that account through another method

## Example
The example shows spending $30 when only $20 was received, resulting in negative money in the cash envelope. The dashed line represents the zero line.

## How to Fix
- Add inflow events to the negative account
- Transfer money from other accounts
- Adjust spending patterns
- Review your timeline for the source of the shortfall

## Important Note
- Debt accounts are expected to be negative
- Only non-debt accounts should trigger this error`,
        tags: ['negative', 'troubleshooting', 'balance']
    },
    {
        id: 'life-event',
        title: 'Life Event',
        category: 'advanced',
        videoSrc: lifeEventVideo,
        duration: '4:45',
        description: `# Life Event

Life Events is an event that has no effect on your financial system. Use this to put key markers in your timeline.

## Purpose
- Mark important life milestones
- Create reference points in your timeline
- Organize your financial planning around life events

## How to Use
- Click button at top to show different time frames
- Use range picker to see key life events
- Add events like graduations, career changes, family milestones

## Pro Tip
Set 5-10 life events in the 3 month, 1 year, 10 year, and 50 year time frames to create a comprehensive life timeline.

## Benefits
- Better organization of your financial timeline
- Clear reference points for planning
- Enhanced visualization of life milestones`,
        tags: ['life-events', 'advanced', 'planning']
    },
    {
        id: 'cd-envelope',
        title: 'CD Envelope',
        category: 'advanced',
        videoSrc: cdEnvelopeVideo,
        duration: '3:45',
        description: `# Envelopes

Envelopes are used to track different accounts or categories of money. Each has a different growth rate and mechanism.

## Examples of Envelopes
- Checking account
- CD account
- 401K
- Home
- Car
- Credit card debt
- Student loan debt

## Envelope Categories
Envelopes are categorized into 5 main categories:

**Cash** - For envelopes and accounts that typically do not grow over time (cash, checking account, etc.)

**Savings** - For envelopes and accounts that typically grow over time in high yield savings accounts or similar (savings account, etc.)

**Debt** - For envelopes and accounts that typically grow over time (credit card debt, student loan debt, etc.)

**Investment** - For envelopes and accounts that typically grow over time (Stocks, Bonds, Mutual Funds, etc.)

**Retirement** - For envelopes and accounts that typically grow over time, typically tax advantaged accounts (401K, IRA, etc.)

## Important Note
The category of an envelope does not affect the simulation. It is only used to categorize envelopes for visual effect.`,
        tags: ['cd', 'envelope', 'advanced', 'investments']
    },
    {
        id: 'car',
        title: 'Car',
        category: 'advanced',
        videoSrc: carVideo,
        duration: '4:45',
        description: `# Car

The car event shows a car being purchased.

## How It Works
The cash envelope becomes negative because the car event simulates monthly payments from cash to pay off the car loan. With no income to cash, the cash envelope goes negative to pay the down payment and the car loan.

## Important Settings
- **Debt Rate**: Set to the car loan rate (monthly interest rate)
- **Car Depreciation Rate**: Set the rate you expect for your car

## Key Points
- The car event follows an amortization schedule based on monthly compounding debt
- Do not change the debt growth rate to another growth rate
- The event automatically handles down payment and loan payments
- Car value depreciation is tracked separately from the debt
- Similar to house events but for vehicle purchases`,
        tags: ['car', 'vehicle', 'advanced', 'assets']
    },
    {
        id: 'loan',
        title: 'Loan',
        category: 'advanced',
        videoSrc: loanVideo,
        duration: '3:10',
        description: `# Loan

A loan shows a basic amortization schedule for a loan over a specified time.

## How It Works
- Creates a debt envelope with the loan amount
- Follows standard amortization schedule
- Tracks both principal and interest payments

## Important Settings
- **Loan Interest Rate**: Put into the growth rate of the debt envelope at a monthly interest rate
- **Loan Amount**: The total amount borrowed
- **Loan Term**: The duration of the loan

## Key Points
- Use for any type of loan (personal, business, etc.)
- Automatically calculates monthly payments
- Tracks remaining balance over time
- Can be combined with other events for complex scenarios`,
        tags: ['loan', 'debt', 'advanced', 'financing']
    },
    {
        id: 'transfer',
        title: 'Transfer',
        category: 'getting-started',
        videoSrc: transferVideo,
        duration: '2:50',
        description: `# Transfer

A transfer event moves money from one envelope to another at the specified time.

## How It Works
The timeline shows the envelopes as stacked. The decrease in one envelope and increase in another displays the transaction.

## Common Use Cases
- Moving money from checking to savings
- Transferring funds to investment accounts
- Allocating income to different categories
- Rebalancing portfolio allocations

## Pro Tip
Add a recurring transfer event with your income for when you transfer money to savings, investments, or other accounts.

## Key Points
- No money enters or leaves your system
- Simply reallocates existing funds
- Can be one-time or recurring`,
        tags: ['transfer', 'movement', 'basics']
    }
];

// Video segments for onboarding stages
export interface VideoSegment {
    stageKey: string;
    videoIds: string[];
    title: string;
    description: string;
}

export const onboardingVideoSegments: VideoSegment[] = [
    {
        stageKey: 'basics',
        videoIds: ['inflow-events', 'outflow-events', 'cd-envelope', 'negative-money'],
        title: 'Understanding Money Flow',
        description: 'Learn the fundamentals of how money moves in and out of your system'
    },
    {
        stageKey: 'updating_events',
        videoIds: ['life-event', 'reocurring-event', 'inflation'],
        title: 'Setting Up Your Budget',
        description: 'Learn how to create and manage your budget envelopes'
    },
    {
        stageKey: 'declare_accounts',
        videoIds: ['declare-accounts', 'transfer', 'updating-events'],
        title: 'Adding Life Events',
        description: 'Learn how to add and manage financial events in your timeline'
    },
    {
        stageKey: 'assets',
        videoIds: ['loan', 'car', 'house', 'function-parts', 'compare-plans', '59_12_gap'],
        title: 'Advanced Features',
        description: 'Explore powerful features for complex financial scenarios'
    },
];

// Utility functions
export const getVideoById = (id: string): VideoItem | undefined => {
    return videoLibrary.find(video => video.id === id);
};

export const getVideosByCategory = (categoryId: string): VideoItem[] => {
    return videoLibrary.filter(video => video.category === categoryId);
};

export const getAllVideos = (): VideoItem[] => {
    return videoLibrary;
};
