import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white">
        <h1 className="text-6xl font-bold mb-4">HRMS Portal 2026</h1>
        <p className="text-2xl mb-8">
          Comprehensive Human Resource Management System
        </p>
        <div className="space-x-4">
          <Link
            to="/login"
            className="inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:bg-gray-100 transition duration-300"
          >
            Login
          </Link>
          <Link
            to="/dashboard"
            className="inline-block px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 transition duration-300"
          >
            Dashboard
          </Link>
        </div>
        <div className="mt-12 text-lg">
          <p className="mb-2">✨ Features:</p>
          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              🧑‍💼 Core HR & Payroll
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              🤖 AI-Powered ATS
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              💬 AI Chatbot
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              📊 Analytics & Reports
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
