import { getDailyQuote } from '../../services/dashboard.service';

const MotivationQuote = () => {
  const { quote, author } = getDailyQuote();

  return (
    <div className="px-6 py-4 relative overflow-hidden text-center rounded-xl bg-gradient-to-r from-gray-50 via-white to-gray-50 border border-gray-100 shadow-sm group transition-all duration-700 hover:shadow-md">
      {/* Animated shimmer sweep */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-blue-50/60 to-transparent" />

      {/* Subtle bottom accent line with animation */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-0 group-hover:w-3/4 bg-gradient-to-r from-transparent via-blue-400 to-transparent transition-all duration-700 ease-out" />

      {/* Quote icon */}
      <div className="absolute top-3 left-4 text-blue-200/50 transition-transform duration-700 group-hover:scale-110">
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
      </div>

      {/* Closing quote icon */}
      <div className="absolute bottom-3 right-4 text-blue-200/50 rotate-180 transition-transform duration-700 group-hover:scale-110">
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
      </div>

      <div className="relative z-10">
        <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-[0.15em] mb-1.5 transition-colors duration-500 group-hover:text-blue-600">Daily Motivation</p>
        <p className="text-gray-700 text-sm font-medium leading-snug mb-1.5 italic transition-colors duration-500 group-hover:text-gray-900">
          &ldquo;{quote}&rdquo;
        </p>
        <p className="text-gray-400 text-xs font-medium transition-colors duration-500 group-hover:text-gray-500">
          &mdash; {author}
        </p>
      </div>
    </div>
  );
};

export default MotivationQuote;
