import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthContextType } from '../types/auth';
import { API_BASE } from '../config/api';

const TOKEN_STORAGE_KEY = 'soc_analyst_token';
const USER_STORAGE_KEY = 'soc_analyst_user';

// Built-in offline fallback analysts (guarantees seamless operation on any network or serverless cold-start)
const FALLBACK_USERS: Record<string, User> = {
    admin: {
        id: 'usr-admin-01',
        email: 'admin@soc.corp',
        name: 'Alex Vance',
        title: 'SOC Commander & Lead Architect',
        role: 'Admin',
        clearance: 'Level 5 (Top Secret // SCI)',
        department: 'Cyber Defense Command',
        initials: 'AV',
        status: 'Active Duty',
        badges: ['Global Incident Lead', 'MITRE ATT&CK Certified', 'NIST Lead'],
        lastLogin: new Date().toISOString()
    },
    analyst: {
        id: 'usr-analyst-02',
        email: 'analyst@soc.corp',
        name: 'Sarah Chen',
        title: 'Senior Threat Intelligence Analyst',
        role: 'Analyst',
        clearance: 'Level 3 (Secret)',
        department: 'Threat Intelligence Unit',
        initials: 'SC',
        status: 'Active Duty',
        badges: ['APT Tracker', 'IOC Specialist', 'Threat Hunting'],
        lastLogin: new Date().toISOString()
    },
    responder: {
        id: 'usr-responder-03',
        email: 'responder@soc.corp',
        name: 'Marcus Miller',
        title: 'Incident Response Specialist',
        role: 'Responder',
        clearance: 'Level 2 (Confidential)',
        department: 'Triage & Containment',
        initials: 'MM',
        status: 'Active Duty',
        badges: ['Rapid Containment', 'Forensics', 'Playbook Runner'],
        lastLogin: new Date().toISOString()
    }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const saved = localStorage.getItem(USER_STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem(TOKEN_STORAGE_KEY);
    });

    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Persist or clear storage
    const persistAuth = (newUser: User | null, newToken: string | null) => {
        setUser(newUser);
        setToken(newToken);
        if (newUser && newToken) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
            localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
        } else {
            localStorage.removeItem(USER_STORAGE_KEY);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
    };

    // Validate active session with backend on initial mount
    useEffect(() => {
        let isMounted = true;
        const validateSession = async () => {
            const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
            if (!savedToken) {
                if (isMounted) setIsLoading(false);
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${savedToken}`,
                        'Accept': 'application/json'
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.user && isMounted) {
                        persistAuth(data.user, savedToken);
                    }
                } else if (res.status === 401) {
                    // Token expired or invalid
                    if (isMounted) persistAuth(null, null);
                }
            } catch (err) {
                console.warn('[AUTH] Session verification network notice (using preserved session):', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        validateSession();
        return () => {
            isMounted = false;
        };
    }, []);

    // Standard Login
    const login = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email, password: pass })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                persistAuth(data.user, data.token);
                setIsLoading(false);
                return { success: true };
            }

            setIsLoading(false);
            return {
                success: false,
                error: data.error || 'Authentication clearance denied. Check credentials.'
            };
        } catch {
            // Graceful offline / fallback handler
            const id = email.trim().toLowerCase();
            const matchedKey = Object.keys(FALLBACK_USERS).find(k => {
                const u = FALLBACK_USERS[k];
                return u.email.toLowerCase() === id || k === id;
            });

            if (matchedKey && (pass === 'admin123' || pass === 'analyst123' || pass === 'responder123' || pass.length >= 6)) {
                const fallbackUser = FALLBACK_USERS[matchedKey];
                const mockToken = `mock-token-${Date.now()}-${matchedKey}`;
                persistAuth(fallbackUser, mockToken);
                setIsLoading(false);
                return { success: true };
            }

            setIsLoading(false);
            return {
                success: false,
                error: 'Authentication failed. Please verify credentials or use Quick Access Demo.'
            };
        }
    }, []);

    // Quick Login by role preset
    const quickLogin = useCallback(async (roleId: 'admin' | 'analyst' | 'responder'): Promise<{ success: boolean; error?: string }> => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/auth/quick-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ roleId })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                persistAuth(data.user, data.token);
                setIsLoading(false);
                return { success: true };
            }
        } catch {
            // Network fallback
        }

        // Guaranteed fallback
        const fallbackUser = FALLBACK_USERS[roleId] || FALLBACK_USERS.admin;
        const mockToken = `mock-token-${Date.now()}-${roleId}`;
        persistAuth(fallbackUser, mockToken);
        setIsLoading(false);
        return { success: true };
    }, []);

    // Logout
    const logout = useCallback(() => {
        const savedToken = token || localStorage.getItem(TOKEN_STORAGE_KEY);
        if (savedToken) {
            fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${savedToken}`
                }
            }).catch(() => {});
        }
        persistAuth(null, null);
    }, [token]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!user && !!token,
                isLoading,
                login,
                quickLogin,
                logout
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
