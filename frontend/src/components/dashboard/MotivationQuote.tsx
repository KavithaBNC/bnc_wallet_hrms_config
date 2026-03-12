import { getDailyQuote } from '../../services/dashboard.service';

const MotivationQuote = () => {
  const { quote, author } = getDailyQuote();

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-6 relative overflow-hidden transition-all duration-300 hover:shadow-xl">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      <div className="absolute top-4 left-4 text-white/10">
        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
      </div>

      <div className="relative z-10">
        <p className="text-xs text-indigo-200 font-medium uppercase tracking-wider mb-3">Daily Motivation</p>
        <p className="text-white text-base font-medium leading-relaxed mb-3">
          &ldquo;{quote}&rdquo;
        </p>
        <p className="text-indigo-200 text-sm font-medium">
          &mdash; {author}
        </p>
      </div>
    </div>
  );
};

export default MotivationQuote;
