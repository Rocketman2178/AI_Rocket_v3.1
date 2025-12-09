import React, { useState, useEffect } from 'react';
import { X, BarChart, Loader2, CheckCircle, Sparkles, TrendingUp, Eye, Zap, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatAstraMessage } from '../../utils/formatAstraMessage';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../lib/supabase';

interface VisualizationBoosterModalProps {
  onClose: () => void;
  onComplete: () => void;
  astraResponse?: string; // The response from the previous guided chat step
}

export const VisualizationBoosterModal: React.FC<VisualizationBoosterModalProps> = ({
  onClose,
  onComplete,
  astraResponse
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'loading' | 'show_message' | 'generating' | 'showing_viz'>('loading');
  const [visualizationHtml, setVisualizationHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [fetchedAstraResponse, setFetchedAstraResponse] = useState<string>('');
  const [carouselIndex, setCarouselIndex] = useState(0);

  const carouselItems = [
    {
      icon: Eye,
      title: 'See Patterns Instantly',
      description: 'Transform complex data into clear visual insights that reveal patterns you might miss in text.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: TrendingUp,
      title: 'Track Progress',
      description: 'Monitor trends and changes over time with interactive charts and graphs.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Zap,
      title: 'Make Faster Decisions',
      description: 'Quickly identify key metrics and make data-driven decisions with confidence.',
      color: 'from-orange-500 to-yellow-500'
    },
    {
      icon: BarChart,
      title: 'Share With Your Team',
      description: 'Create compelling visualizations that communicate insights effectively to stakeholders.',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  // Rotate carousel during generation
  useEffect(() => {
    if (step === 'generating') {
      const interval = setInterval(() => {
        setCarouselIndex((prev) => (prev + 1) % carouselItems.length);
      }, 3000); // Change every 3 seconds

      return () => clearInterval(interval);
    }
  }, [step]);

  // Fetch the most recent Astra chat response from database
  useEffect(() => {
    const fetchLatestAstraResponse = async () => {
      if (!user) return;

      try {
        // Fetch the most recent Astra response from astra_chats
        // Note: astra_chats uses user_id and message_type, not team_id and sender
        const { data: chatData, error: chatError } = await supabase
          .from('astra_chats')
          .select('message')
          .eq('user_id', user.id)
          .eq('message_type', 'astra')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (chatError) {
          console.error('Error fetching Astra chat:', chatError);
        }

        if (chatData?.message) {
          console.log('✅ Fetched Astra response from database:', chatData.message.substring(0, 200));
          setFetchedAstraResponse(chatData.message);
        } else {
          console.log('No Astra response found in database, using prop or fallback');
        }

        setStep('show_message');
      } catch (err) {
        console.error('Error in fetchLatestAstraResponse:', err);
        setStep('show_message');
      }
    };

    if (step === 'loading') {
      fetchLatestAstraResponse();
    }
  }, [user, step]);

  const handleCreateVisualization = async () => {
    if (!user) return;

    // Priority: fetched from database > prop > fallback
    const messageText = fetchedAstraResponse || astraResponse || 'Create a visualization showing key insights from recent data';

    console.log('📊 Creating visualization with message length:', messageText.length);
    console.log('📊 Message source:', fetchedAstraResponse ? 'database' : astraResponse ? 'prop' : 'fallback');

    setStep('generating');
    setError(null);

    try {
      // Get API key from environment
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error('Gemini API key not found');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        generationConfig: {
          temperature: 1.0,
          topK: 64,
          topP: 0.95,
          maxOutputTokens: 100000,
        }
      });

      const baseDesign = `DESIGN REQUIREMENTS:
- Use a dark theme with gray-900 (#111827) background
- Use gray-800 (#1f2937) and gray-700 (#374151) for card backgrounds
- Use white (#ffffff) and gray-300 (#d1d5db) for text
- Use blue (#3b82f6), purple (#8b5cf6), and cyan (#06b6d4) for accents and highlights
- Match the visual style of a modern dark dashboard
- Include proper spacing, rounded corners, and subtle shadows
- Use responsive layouts with flexbox or CSS grid
- Ensure all content fits within containers without overflow`;

      const prompt = `Create a comprehensive visual dashboard to help understand the information in the message below.

${baseDesign}
- Use graphics, emojis, and charts as needed to enhance the visualization
- Include visual elements like progress bars, icons, charts, and infographics where appropriate
- Make the dashboard visually engaging with relevant emojis and graphical elements

CRITICAL TYPOGRAPHY & SIZING RULES:
- Headings: Use max font-size of 1.875rem (30px)
- Large numbers/metrics: Use max font-size of 2rem (32px) with clamp() for responsiveness
- Subheadings: 1rem to 1.25rem (16-20px)
- Body text: 0.875rem to 1rem (14-16px)

CRITICAL LAYOUT RULES TO PREVENT OVERFLOW:
- Add padding inside ALL cards and containers (minimum 1rem on all sides)
- Use word-wrap: break-word on all text elements
- Use overflow-wrap: break-word to handle long numbers and text
- For responsive card grids, use: display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;
- Never use fixed widths that might cause overflow
- Ensure numbers scale down on smaller containers using clamp() or max-width with text wrapping

MESSAGE TEXT:
${messageText}

Return only the HTML code - no other text or formatting.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let cleanedContent = response.text();

      // Clean up the response - remove markdown code blocks if present
      cleanedContent = cleanedContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

      // Ensure it starts with DOCTYPE if it's a complete HTML document
      if (!cleanedContent.toLowerCase().includes('<!doctype') && !cleanedContent.toLowerCase().includes('<html')) {
        cleanedContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visualization</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            background: #111827;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            width: 100%;
            overflow-x: hidden;
        }
        /* Prevent text overflow in all elements */
        h1, h2, h3, h4, h5, h6, p, div, span {
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
        }
        /* Enforce maximum font sizes */
        h1 { font-size: clamp(1.5rem, 4vw, 1.875rem) !important; }
        h2 { font-size: clamp(1.25rem, 3.5vw, 1.5rem) !important; }
        h3 { font-size: clamp(1.125rem, 3vw, 1.25rem) !important; }
        /* Responsive images */
        img {
            max-width: 100%;
            height: auto;
        }
        /* Ensure all containers have proper padding and prevent overflow */
        [class*="card"], [class*="container"], [class*="box"], [style*="padding"] {
            padding: 1rem !important;
            overflow: hidden;
        }
    </style>
</head>
<body>
    ${cleanedContent}
</body>
</html>`;
      }

      setVisualizationHtml(cleanedContent);
      setStep('showing_viz');
    } catch (err: any) {
      console.error('Error creating visualization:', err);
      setError(err.message || 'Failed to create visualization');
      setStep('show_message');
    }
  };

  const handleProceed = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <BarChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Data Visualizations</h2>
              <p className="text-sm text-gray-300">Turn insights into visuals</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading Step */}
          {step === 'loading' && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-300">Loading your data...</p>
              </div>
            </div>
          )}

          {/* Step 1: Show Astra's previous message */}
          {step === 'show_message' && (
            <div className="space-y-6">
              {(fetchedAstraResponse || astraResponse) && (
                <div className="bg-purple-900/10 border border-purple-700/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <p className="text-sm text-gray-400">Astra's Previous Insights:</p>
                  </div>
                  <div className="text-white prose prose-invert max-w-none">
                    {formatAstraMessage(fetchedAstraResponse || astraResponse || '')}
                  </div>
                </div>
              )}

              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <BarChart className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-300 font-medium mb-1">
                      Ready to Visualize?
                    </p>
                    <p className="text-sm text-gray-300">
                      Click below to transform Astra's insights into an interactive visualization. This helps you spot trends and patterns at a glance!
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                  <p className="text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Generating visualization with Carousel */}
          {step === 'generating' && (
            <div className="py-8 space-y-6">
              {/* Warning Banner */}
              <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-orange-300 font-medium">Do not close or navigate away during this process</p>
                  <p className="text-orange-400/70 text-sm mt-1">Astra is creating your visualization</p>
                </div>
              </div>

              <div className="text-center mb-8">
                <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Creating Your Visualization</h3>
                <p className="text-gray-400">Astra is analyzing your data and generating a visual dashboard...</p>
              </div>

              {/* Benefits Carousel */}
              <div className="max-w-2xl mx-auto">
                <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-xl p-8 min-h-[200px] flex flex-col items-center justify-center relative">
                  {carouselItems.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={index}
                        className={`text-center transition-all duration-500 ${
                          index === carouselIndex
                            ? 'opacity-100 scale-100 relative'
                            : 'opacity-0 scale-95 absolute'
                        }`}
                      >
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-xl font-bold text-white mb-3">{item.title}</h4>
                        <p className="text-gray-300 text-sm max-w-md">{item.description}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Carousel Indicators */}
                <div className="flex justify-center gap-2 mt-4">
                  {carouselItems.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === carouselIndex
                          ? 'w-8 bg-cyan-400'
                          : 'w-2 bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Show visualization */}
          {step === 'showing_viz' && visualizationHtml && (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-green-300 font-medium">Visualization Created!</p>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div
                  className="w-full"
                  dangerouslySetInnerHTML={{ __html: visualizationHtml }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 bg-gray-800/50 flex justify-end items-center gap-3 flex-shrink-0">
          {step === 'show_message' && (
            <button
              onClick={handleCreateVisualization}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg hover:shadow-xl font-medium min-h-[44px]"
            >
              <BarChart className="w-5 h-5" />
              Create Visualization
            </button>
          )}

          {step === 'showing_viz' && (
            <button
              onClick={handleProceed}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg hover:shadow-xl font-medium min-h-[44px]"
            >
              <CheckCircle className="w-5 h-5" />
              Proceed
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
