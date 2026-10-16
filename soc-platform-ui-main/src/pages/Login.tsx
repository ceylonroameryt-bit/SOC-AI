import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Shield,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    AlertCircle,
    UserCheck,
    Cpu,
    Radio,
    ShieldCheck,
    ArrowRight
} from 'lucide-react';

interface DemoRoleOption {
    roleId: 'admin' | 'analyst' | 'responder';
    name: string;
    email: string;
    pass: string;
    role: string;
    clearance: string;
    badge: string;
    badgeColor: string;
    description: string;
}

const DEMO_ROLES: DemoRoleOption[] = [
    {
        roleId: 'admin',
        name: 'Alex Vance',
        email: 'admin@soc.corp',
        pass: 'admin123',
        role: 'Lead SecOps Commander',
        clearance: 'Level 5 (Top Secret // SCI)',
        badge: 'Full Command & Admin',
        badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        description: 'Complete platform administration, pipeline management & incident escalations.'
    },
    {
        roleId: 'analyst',
        name: 'Sarah Chen',
        email: 'analyst@soc.corp',
        pass: 'analyst123',
        role: 'Senior Threat Analyst',
        clearance: 'Level 3 (Secret)',
        badge: 'Threat Intel & MITRE',
        badgeColor: 'text-teal-300 border-teal-500/30 bg-teal-500/10',
        description: 'Threat hunting, IOC enrichment, MITRE ATT&CK mapping & analysis.'
    },
    {
        roleId: 'responder',
        name: 'Marcus Miller',
        email: 'responder@soc.corp',
        pass: 'responder123',
        role: 'Incident Responder',
        clearance: 'Level 2 (Confidential)',
        badge: 'Triage & Containment',
        badgeColor: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
        description: 'Real-time alert triage, containment verification & reporting.'
    }
];

export const Login: React.FC = () => {
    const { login, quickLogin, isLoading, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('admin@soc.corp');
    const [password, setPassword] = useState('admin123');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(true);
    const [activeTab, setActiveTab] = useState<'quick' | 'manual'>('quick');

    // Where to redirect after login (preserve attempted route)
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/intelligence';

    // If already authenticated, redirect immediately
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, from]);

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email.trim() || !password) {
            setError('Please enter both analyst identifier and security passkey.');
            return;
        }

        const res = await login(email.trim(), password);
        if (res.success) {
            navigate(from, { replace: true });
        } else {
            setError(res.error || 'Authentication denied. Invalid clearance credentials.');
        }
    };

    const handleQuickLoginClick = async (role: DemoRoleOption) => {
        setError(null);
        setEmail(role.email);
        setPassword(role.pass);
        const res = await quickLogin(role.roleId);
        if (res.success) {
            navigate(from, { replace: true });
        } else {
            setError(res.error || 'Failed to authenticate with selected role.');
        }
    };

    return (
        <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-between relative selection:bg-teal-500/30 selection:text-white overflow-x-hidden font-sans">
            {/* Background Calm Under Fire Ambient Grid & Teal Radial Glows */}
            <div className="fixed inset-0 bg-[radial-gradient(#0D9488_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />
            <div className="fixed -top-40 -left-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-teal-800/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top Operations Header */}
            <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-[#0B132B]/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(13,148,136,0.35)]">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-sm tracking-widest text-white uppercase font-mono">
                                NO ENTRY
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 font-mono bg-slate-800 text-teal-400 border border-teal-500/30 rounded font-semibold">
                                CALM RESILIENCE v2.4
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans">
                            Calm Under Fire · Enterprise Cyber Defense &amp; Intelligence Grid
                        </p>
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                        <span className="text-slate-300">GRID: NOMINAL (100% OPERATIONAL)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-teal-300 font-semibold px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/30">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                        <span>DEFENSE PERIMETER STABLE</span>
                    </div>
                </div>
            </header>

            {/* Main Center Content Box */}
            <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
                <div className="w-full max-w-xl bg-slate-900/85 border border-slate-700/60 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden">
                    
                    {/* Header Accent Bar - Soothing Teal-to-Emerald Gradient */}
                    <div className="h-1 bg-gradient-to-r from-teal-600 via-teal-400 to-emerald-400" />

                    <div className="p-6 sm:p-8">
                        {/* Title & Reassuring Tagline */}
                        <div className="mb-6 text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-mono font-medium mb-3">
                                <Radio className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                                <span>CALM UNDER FIRE OPERATIONAL GATEWAY</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                                Analyst Clearance Authentication
                            </h1>
                            <div className="mt-2 py-1 px-3.5 rounded-lg bg-teal-950/40 border border-teal-700/40 inline-block">
                                <p className="text-xs sm:text-sm font-medium text-teal-200">
                                    🛡️ You are protected. System status optimal.
                                </p>
                            </div>
                            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">
                                Continuous threat monitoring, IOC enrichment, and automated triage active across all feeds.
                            </p>
                        </div>

                        {/* Error Alert Display - Warm Amber (NO Panic Red) */}
                        {error && (
                            <div className="mb-6 p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <span className="font-semibold block text-amber-300">Access Attention</span>
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}

                        {/* Access Mode Selector Tabs */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/70 border border-slate-800 rounded-xl mb-6">
                            <button
                                type="button"
                                onClick={() => setActiveTab('quick')}
                                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                                    activeTab === 'quick'
                                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 font-semibold'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                            >
                                <UserCheck className="w-4 h-4" />
                                <span>1-Click Demo Access</span>
                                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">Fast</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('manual')}
                                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                                    activeTab === 'manual'
                                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 font-semibold'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                            >
                                <Lock className="w-4 h-4" />
                                <span>Manual Passkey Entry</span>
                            </button>
                        </div>

                        {/* TAB 1: 1-Click Fast Demo Roles */}
                        {activeTab === 'quick' ? (
                            <div className="space-y-3">
                                <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between px-1">
                                    <span>Select Operational Role to Authorize</span>
                                    <span className="text-teal-400 font-semibold">Instant Verification</span>
                                </div>

                                {DEMO_ROLES.map((r) => (
                                    <div
                                        key={r.roleId}
                                        onClick={() => handleQuickLoginClick(r)}
                                        className="group relative p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-teal-500/60 hover:bg-slate-800/60 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs hover:shadow-[0_0_20px_rgba(13,148,136,0.18)]"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-teal-950/60 border border-teal-700/50 flex items-center justify-center text-teal-300 font-bold text-sm group-hover:scale-105 group-hover:border-teal-400 transition-all flex-shrink-0">
                                                {r.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors truncate">
                                                        {r.name}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold ${r.badgeColor}`}>
                                                        {r.role}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                                    <span className="font-mono text-[11px] text-slate-300">{r.email}</span>
                                                    <span>•</span>
                                                    <span className="text-[11px] text-slate-400 truncate">{r.clearance}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                                                    {r.description}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isLoading}
                                            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-teal-600/15 border border-teal-500/40 text-teal-300 group-hover:bg-teal-600 group-hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5"
                                        >
                                            <span>Authorize</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                    </div>
                                ))}

                                <div className="pt-2 text-center">
                                    <p className="text-[11px] text-slate-400">
                                        Need to test custom credentials or sign up a new analyst identity?{' '}
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('manual')}
                                            className="text-teal-400 hover:underline font-semibold"
                                        >
                                            Use Manual Entry
                                        </button>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* TAB 2: Manual Credentials Form */
                            <form onSubmit={handleManualSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                                        OPERATIONAL CALLSIGN / EMAIL
                                    </label>
                                    <input
                                        type="text"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="e.g. admin@soc.corp or analyst@soc.corp"
                                        required
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm text-white placeholder-slate-500 outline-none transition-colors font-mono"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Demo defaults: <code className="text-teal-400">admin@soc.corp</code> or <code className="text-teal-400">analyst@soc.corp</code>
                                    </p>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-semibold text-slate-300 font-mono">
                                            SECURITY PASSKEY
                                        </label>
                                        <span className="text-[11px] text-slate-400 font-mono">
                                            Default: <code className="text-teal-400">admin123</code>
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••••••"
                                            required
                                            className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm text-white placeholder-slate-500 outline-none transition-colors font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                            className="rounded border-slate-700 bg-slate-900 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span>Persist terminal session</span>
                                    </label>
                                    <span className="text-slate-400 text-[11px] font-mono">
                                        Session Validity: 7 Days
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                >
                                    {isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Validating Biometrics &amp; Clearance...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Shield className="w-4 h-4" />
                                            <span>Authenticate &amp; Access Workspace</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Security Clearance Compliance Footer */}
                    <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 text-center">
                        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                                <span>NIST SP 800-61 Audited</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Cpu className="w-3.5 h-3.5 text-teal-400" />
                                <span>MITRE ATT&amp;CK v15 Matrix</span>
                            </span>
                            <span>•</span>
                            <span>AES-256 GCM</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Compliance & Security Notice */}
            <footer className="relative z-10 w-full px-6 py-3 text-center border-t border-slate-800/80 bg-[#0B132B]/60 text-[11px] text-slate-400">
                <p>
                    RESTRICTED GOVERNMENT &amp; ENTERPRISE SECURITY SYSTEM. SYSTEM STATUS OPTIMAL. ALL TELEMETRY EXPORTS ARE AUDITED.
                </p>
            </footer>
        </div>
    );
};

export default Login;
