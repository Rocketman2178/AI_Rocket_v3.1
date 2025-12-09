import React from 'react';

export const MarketingLogo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6">
        {/* AI Rocket Logo - Blue background with rocket */}
        <div className="flex items-center gap-4">
          <div className="w-32 h-32 rounded-full bg-blue-400 flex items-center justify-center">
            <span className="text-6xl">🚀</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-6xl font-bold text-blue-400">
              AI Rocket
            </h1>
            <span className="text-6xl font-bold text-white">+</span>
          </div>
        </div>
        {/* Astra Intelligence Logo - Green text */}
        <h2 className="text-6xl font-bold text-emerald-400">
          Astra Intelligence
        </h2>
      </div>
    </div>
  );
};
