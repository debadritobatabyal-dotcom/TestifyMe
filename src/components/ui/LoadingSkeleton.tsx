import React from 'react';

export const QuestionSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 animate-pulse">
      <div className="h-6 w-32 bg-purple-200/50 rounded-full" />
      <div className="bg-white rounded-[24px] p-6 border border-purple-500/10 space-y-4 shadow-sm">
        <div className="h-6 w-3/4 bg-gray-200 rounded-md" />
        <div className="h-4 w-1/2 bg-gray-100 rounded-md" />
        <div className="space-y-3 pt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 bg-gray-50 border border-gray-100 rounded-[18px]" />
          ))}
        </div>
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-[24px] p-6 border border-purple-500/10 shadow-sm animate-pulse space-y-3">
      <div className="h-5 w-24 bg-purple-200/60 rounded-full" />
      <div className="h-8 w-16 bg-gray-200 rounded-md" />
      <div className="h-4 w-32 bg-gray-100 rounded-md" />
    </div>
  );
};

export const TableSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-[24px] p-4 sm:p-6 border border-purple-500/10 shadow-sm animate-pulse space-y-4">
      <div className="h-6 w-48 bg-gray-200 rounded-md" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-12 bg-gray-50 rounded-xl" />
        ))}
      </div>
    </div>
  );
};
