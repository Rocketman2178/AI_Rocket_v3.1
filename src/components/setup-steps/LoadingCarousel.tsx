import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, PieChart, Calendar, Target, DollarSign, Sparkles, FileText, MessageSquare, BookOpen } from 'lucide-react';

interface CarouselItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

interface LoadingCarouselProps {
  type: 'visualization' | 'report' | 'sync';
}

export const LoadingCarousel: React.FC<LoadingCarouselProps> = ({ type }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const visualizationItems: CarouselItem[] = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Track Trends',
      description: 'Visualize patterns and changes over time',
      color: 'text-blue-400'
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: 'Monitor Goals',
      description: 'See progress toward strategic objectives',
      color: 'text-green-400'
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: 'View Timelines',
      description: 'Understand when events and milestones occur',
      color: 'text-orange-400'
    },
    {
      icon: <PieChart className="w-8 h-8" />,
      title: 'Compare Data',
      description: 'Break down metrics by category or segment',
      color: 'text-purple-400'
    }
  ];

  const reportItems: CarouselItem[] = [
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Strategic Insights',
      description: 'AI analyzes your data to find key patterns',
      color: 'text-blue-400'
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: 'Actionable Recommendations',
      description: 'Get specific next steps based on your data',
      color: 'text-green-400'
    },
    {
      icon: <DollarSign className="w-8 h-8" />,
      title: 'Financial Analysis',
      description: 'Understand cash flow and resource allocation',
      color: 'text-orange-400'
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Progress Tracking',
      description: 'Monitor execution against strategic goals',
      color: 'text-purple-400'
    }
  ];

  const syncItems: CarouselItem[] = [
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: 'Ask Strategic Questions',
      description: 'Get answers about your mission and priorities',
      color: 'text-purple-400'
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: 'Analyze Documents',
      description: 'Understand patterns across your strategy docs',
      color: 'text-blue-400'
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: 'Track Alignment',
      description: 'See how meetings align with strategic goals',
      color: 'text-green-400'
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: 'Generate Insights',
      description: 'Create reports and visualizations instantly',
      color: 'text-orange-400'
    }
  ];

  const items = type === 'visualization' ? visualizationItems : type === 'report' ? reportItems : syncItems;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [items.length]);

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
      <div className="text-center mb-4">
        <h3 className="text-sm font-semibold text-white mb-1">
          {type === 'visualization' ? 'Visualizations Can Show:' : type === 'report' ? 'Reports Can Provide:' : 'Soon You\'ll Be Able To:'}
        </h3>
      </div>

      <div className="relative h-40 overflow-hidden">
        {items.map((item, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              index === currentIndex
                ? 'opacity-100 translate-x-0'
                : index < currentIndex
                ? 'opacity-0 -translate-x-full'
                : 'opacity-0 translate-x-full'
            }`}
          >
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <div className={`${item.color} bg-gray-900/50 rounded-full p-4`}>
                {item.icon}
              </div>
              <h4 className="text-lg font-bold text-white">{item.title}</h4>
              <p className="text-sm text-gray-300 text-center max-w-xs">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center space-x-2 mt-4">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex ? 'bg-orange-400 w-6' : 'bg-gray-600'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
