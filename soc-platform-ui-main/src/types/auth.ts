export interface User {
    id: string;
    email: string;
    name: string;
    title: string;
    role: 'Admin' | 'Analyst' | 'Responder' | string;
    clearance: string;
    department: string;
    initials: string;
    status?: string;
    badges?: string[];
    lastLogin?: string;
}

export interface DemoAccount {
    id: string;
    roleId: string;
    name: string;
    email: string;
    title: string;
    role: string;
    clearance: string;
    department: string;
    initials: string;
    demoPasswordHint: string;
    badges: string[];
}

export interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    quickLogin: (roleId: 'admin' | 'analyst' | 'responder') => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}
