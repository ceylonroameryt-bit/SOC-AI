import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Lock } from 'lucide-react';

interface ProtectedRouteProps {
    children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0A121E] flex flex-col items-center justify-center text-slate-100 p-6 relative overflow-hidden">
                {/* Background Cyber Grid */}
                <div className="absolute inset-0 bg-[radial-gradient(#147DFA_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
                    <div className="relative mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-[#0F223A] border border-[#147DFA]/40 flex items-center justify-center text-[#147DFA] shadow-[0_0_25px_rgba(20,125,250,0.3)] animate-pulse">
                            <Lock className="w-8 h-8" />
                        </div>
                        <div className="absolute -inset-1 rounded-2xl border border-[#147DFA]/20 animate-ping pointer-events-none" />
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#147DFA] uppercase mb-2 font-semibold">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verifying Security Clearance</span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-100 font-sans tracking-tight mb-2">
                        TacticLens Defense Grid
                    </h2>

                    <p className="text-xs text-slate-400 font-mono">
                        Validating biometric cryptographic session token...
                    </p>

                    <div className="w-48 h-1 bg-slate-800 rounded-full mt-6 overflow-hidden">
                        <div className="h-full bg-linear-to-r from-[#147DFA] to-[#0665F9] w-full animate-[shimmer_1.5s_infinite]" />
                    </div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
