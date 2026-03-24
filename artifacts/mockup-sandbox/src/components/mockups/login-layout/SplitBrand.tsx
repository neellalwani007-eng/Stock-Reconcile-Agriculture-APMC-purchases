import React from 'react';
import { ArrowRightLeft, CheckCircle2 } from 'lucide-react';

export default function SplitBrand() {
  return (
    <div className="min-h-screen flex flex-row w-full font-sans bg-white">
      {/* Left Panel */}
      <div className="hidden lg:flex w-1/2 bg-[#1a4731] flex-col justify-center p-12 lg:p-24 text-white relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-12 right-12 w-64 h-64 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="bg-white/10 p-4 w-fit rounded-2xl mb-8 backdrop-blur-sm border border-white/10 shadow-sm">
            <ArrowRightLeft className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold mb-3 tracking-tight">Stock Reconciler</h1>
          <p className="text-white/70 text-xl mb-12 font-medium">Agricultural Commodity Reconciliation</p>
          
          <div className="space-y-6">
            {[
              "Strict 1-to-1 lot matching",
              "Per-user private data",
              "Full Excel report exports"
            ].map((prop, i) => (
              <div key={i} className="flex items-center space-x-4">
                <CheckCircle2 className="w-6 h-6 text-[#4ade80] shrink-0" />
                <span className="text-white/90 text-lg">{prop}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 sm:p-12 lg:p-24 bg-white">
        <div className="max-w-md w-full mx-auto flex flex-col justify-center h-full">
          {/* Mobile Logo fallback */}
          <div className="lg:hidden flex items-center space-x-3 mb-10">
            <div className="bg-[#1a4731] p-2.5 rounded-xl">
              <ArrowRightLeft className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Stock Reconciler</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome back</h2>
            <p className="text-gray-500 text-lg">Log in to your account to continue</p>
          </div>

          <button 
            onClick={() => {}} 
            className="flex items-center justify-center w-full px-4 py-3.5 border border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a4731] transition-all font-medium text-gray-700 shadow-sm"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Log in with Google
          </button>

          <p className="mt-12 text-center text-sm text-gray-500 leading-relaxed">
            By logging in, you agree to our <br className="hidden sm:block" />
            <a href="#" className="font-medium text-gray-700 hover:text-[#1a4731] hover:underline transition-colors">Terms of Service</a> and <a href="#" className="font-medium text-gray-700 hover:text-[#1a4731] hover:underline transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
