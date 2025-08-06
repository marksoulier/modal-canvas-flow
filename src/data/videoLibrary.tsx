import demoVideo from './demo-video.mp4';

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

This demo shows the **key features** of the application:

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

> 💡 **Tip**: Start with the basics and gradually explore advanced features as you become comfortable with the interface.`,
        tags: ['overview', 'basics', 'tutorial']
    },
    {
        id: 'advanced-planning',
        title: 'Advanced Planning Features',
        category: 'advanced',
        videoSrc: demoVideo, // Using same video for demo - replace with actual advanced video
        duration: '5:20',
        description: `# Advanced Planning Tools

Learn how to leverage **powerful planning features** for complex financial scenarios:

## Advanced Techniques
- **Scenario modeling** - Create multiple "what-if" scenarios
- **Goal tracking** - Set and monitor financial milestones
- **Automated projections** - Let the system forecast outcomes
- **Custom envelope strategies** - Advanced budgeting techniques

## Pro Tips
\`\`\`
// Example: Setting up automated savings
1. Create a "Savings Goal" envelope
2. Set target amount and timeline
3. Enable auto-transfer rules
4. Monitor progress with visual indicators
\`\`\`

### Key Benefits
- ✅ **Predictive insights** - See future cash flow patterns
- ✅ **Risk assessment** - Identify potential financial gaps  
- ✅ **Optimization suggestions** - AI-powered recommendations
- ✅ **Multi-scenario planning** - Compare different strategies

> ⚠️ **Note**: Advanced features require completing the basic onboarding flow first.`,
        tags: ['advanced', 'planning', 'scenarios', 'goals']
    }
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
