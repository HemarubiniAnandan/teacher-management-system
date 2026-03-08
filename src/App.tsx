import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  useParams
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, LogOut, LayoutDashboard, Users, BookOpen, UserCircle, Search, Plus, Edit2, Trash2, ChevronRight, Award, MessageSquare, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Types ---

export type UserRole = 'admin' | 'teacher';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Student {
  id: string;
  regNumber: number;
  name: string;
  parentName: string;
  parentContact: string;
  email: string;
  arrears: number;
}

export interface Allocation {
  id: string;
  className: string;
  startReg: number;
  endReg: number;
  counsellorId: string;
  coordinatorId: string;
}

export interface Certification {
  id: string;
  studentId: string;
  title: string;
  status: 'in-progress' | 'completed';
  fileUrl?: string;
}

export interface Feedback {
  id: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  content: string;
  timestamp: any;
}

// --- Utils ---

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isTeacher: false,
});

export const useAuth = () => useContext(AuthContext);

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
            <h3 className="text-lg font-bold text-stone-900">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-lg transition-colors">
              <Plus className="rotate-45" size={20} />
            </button>
          </div>
          <div className="p-8 max-h-[80vh] overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-stone-50">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      <p className="text-stone-500 font-medium animate-pulse">Loading System...</p>
    </div>
  </div>
);

const Navbar = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <nav className="h-16 border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
          <img src="/Easwari_Engineering_College_logo.png" alt="EduTrack" className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-stone-900 leading-none">EduTrack</h1>
          <p className="text-[10px] text-stone-500 uppercase tracking-widest font-semibold mt-1">Management System</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-sm font-semibold text-stone-900">{profile?.name}</span>
          <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
            {profile?.role}
          </span>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
};

// --- Pages ---

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (isSignUp && !name) {
      setError('Please enter your full name.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use. Try signing in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled in Firebase Console. Please enable it in the Auth tab.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not enabled in Firebase Console. Please enable it in the Auth tab.');
      } else {
        setError(err.message || 'Google sign-in failed. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Password reset is not enabled in Firebase Console. Please enable it in the Auth tab.');
      } else {
        setError('Failed to send reset email. Please check the email address.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isResetting) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 p-10"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-200 mb-4">
               <img src="/Easwari_Engineering_College_logo.png" alt="EduTrack" className="w-8 h-8" />
              </div>
            <h2 className="text-2xl font-bold text-stone-900">Reset Password</h2>
            <p className="text-stone-500 text-sm text-center mt-2">
              {resetSent 
                ? "Check your inbox for the reset link." 
                : "Enter your email to receive a password reset link."}
            </p>
          </div>

          {!resetSent ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  placeholder="teacher@school.edu"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-emerald-700 text-sm text-center mb-6">
              A password reset email has been sent to <strong>{email}</strong>.
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-stone-100 text-center">
            <button 
              onClick={() => {
                setIsResetting(false);
                setResetSent(false);
                setError('');
              }}
              className="text-sm font-semibold text-stone-500 hover:text-stone-900 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 p-10"
      >
        <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-200 mb-4">
               <img src="/Easwari_Engineering_College_logo.png" alt="EduTrack" className="w-8 h-8" />
            </div>
          <h2 className="text-2xl font-bold text-stone-900">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
          <p className="text-stone-500 text-sm">{isSignUp ? 'Join the management system' : 'Sign in to access your dashboard'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Full Name</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                placeholder="John Doe"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
              placeholder="teacher@school.edu"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Password</label>
              {!isSignUp && (
                <button 
                  type="button"
                  onClick={() => setIsResetting(true)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Forgot?
                </button>
              )}
            </div>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium border border-emerald-100">
              {message}
            </div>
          )}

          <div className="space-y-3">
            <button 
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>

            {!isSignUp && (
              <button 
                type="button"
                onClick={() => setIsResetting(true)}
                disabled={loading}
                className="w-full text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-widest"
              >
                Forgot Password?
              </button>
            )}

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-stone-400 font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 bg-white border border-stone-200 text-stone-700 rounded-xl font-bold hover:bg-stone-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </div>
        </form>

        <div className="mt-8 pt-8 border-t border-stone-100 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorInfo: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    try {
      const info = JSON.parse(error.message);
      return { hasError: true, errorInfo: info };
    } catch {
      return { hasError: true, errorInfo: { error: error.message || String(error) } };
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-10 border border-red-100">
            <div className="flex items-center gap-4 mb-6 text-red-600">
              <div className="p-3 bg-red-50 rounded-2xl">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-2xl font-bold">Connection Error</h2>
            </div>
            <p className="text-stone-600 mb-8">
              We encountered an issue connecting to the database. This usually happens due to permission restrictions or configuration issues.
            </p>
            <div className="bg-stone-50 rounded-2xl p-6 font-mono text-xs text-stone-500 overflow-auto max-h-60">
              <pre>{JSON.stringify(this.state.errorInfo, null, 2)}</pre>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-8 w-full h-12 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all"
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Connection test
    const testConnection = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, '_connection_test_', 'ping'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Firestore connection failed: The client is offline. Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Default profile if not found (e.g. first time admin)
            const isDefaultAdmin = firebaseUser.email === 'hemaanand.sp26@gmail.com';
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Administrator',
              email: firebaseUser.email || '',
              role: isDefaultAdmin ? 'admin' : 'teacher'
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;

  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, profile, loading, isAdmin, isTeacher }}>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route 
              path="/*" 
              element={
                user ? (
                  <div className="min-h-screen bg-stone-50">
                    <Navbar />
                    <main className="p-6 max-w-7xl mx-auto">
                      <Routes>
                        <Route path="/" element={isAdmin ? <AdminDashboard /> : <TeacherDashboard />} />
                        <Route path="/student/:id" element={<StudentProfile />} />
                        <Route path="*" element={<Navigate to="/" />} />
                      </Routes>
                    </main>
                  </div>
                ) : (
                  <Navigate to="/login" />
                )
              } 
            />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}

// --- Dashboard Components ---

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'teachers' | 'students' | 'allocations'>('teachers');

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Admin Console</h2>
          <p className="text-stone-500">Manage institutional records and teacher assignments</p>
        </div>
      </header>

      <div className="flex gap-2 p-1 bg-stone-200/50 rounded-2xl w-fit">
        {(['teachers', 'students', 'allocations'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize",
              activeTab === tab 
                ? "bg-white text-stone-900 shadow-sm" 
                : "text-stone-500 hover:text-stone-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'teachers' && <TeacherManagement />}
          {activeTab === 'students' && <StudentManagement />}
          {activeTab === 'allocations' && <AllocationManagement />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};


const StudentCard: React.FC<{ student: Student }> = ({ student }) => {
  const navigate = useNavigate();

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/student/${student.id}`)}
      className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-xl hover:shadow-stone-200/50 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
          <UserCircle size={24} />
        </div>
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">#{student.regNumber}</span>
      </div>
      <h3 className="text-lg font-bold text-stone-900 mb-1">{student.name}</h3>
      <p className="text-sm text-stone-500 mb-4">{student.email}</p>
      
      <div className="flex items-center justify-between pt-4 border-t border-stone-50">
        <div className="flex flex-col">
          <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Arrears</span>
          <span className={cn("font-bold", student.arrears > 0 ? "text-red-500" : "text-emerald-500")}>
            {student.arrears}
          </span>
        </div>
        <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all">
          <ChevronRight size={16} />
        </div>
      </div>
    </motion.div>
  );
};

const TeacherDashboard = () => {
  const { profile } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const unsubAllocations = onSnapshot(collection(db, 'allocations'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Allocation));
      const filtered = data.filter(a => a.counsellorId === profile.uid || a.coordinatorId === profile.uid);
      setAllocations(filtered);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'allocations');
    });

    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'students');
    });

    return () => {
      unsubAllocations();
      unsubStudents();
    };
  }, [profile]);

  const getStudentsForAllocation = (alloc: Allocation) => {
    return students.filter(student => 
      student.regNumber >= alloc.startReg && 
      student.regNumber <= alloc.endReg &&
      (student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       student.regNumber.toString().includes(searchQuery))
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Teacher Dashboard</h2>
          <p className="text-stone-500">Manage your assigned students and track their progress</p>
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Search by name or reg number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-4 h-12 w-full md:w-80 bg-white border border-stone-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
          />
        </div>
      </header>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="animate-spin text-stone-300" size={40} />
        </div>
      ) : allocations.length > 0 ? (
        <div className="space-y-12">
          {allocations.map(alloc => {
            const allocStudents = getStudentsForAllocation(alloc);
            if (allocStudents.length === 0 && searchQuery) return null;

            return (
              <section key={alloc.id} className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-stone-200" />
                  <div className="flex flex-col items-center">
                    <h3 className="text-lg font-bold text-stone-900">{alloc.className}</h3>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      {alloc.counsellorId === profile?.uid ? 'Counsellor' : 'Coordinator'} • Range: {alloc.startReg}-{alloc.endReg}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-stone-200" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allocStudents.length > 0 ? (
                    allocStudents.map((student: Student) => (
                      <StudentCard key={student.id} student={student} />
                    ))
                  ) : (
                    <div className="col-span-full py-10 bg-white rounded-3xl border border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400">
                      <p className="text-sm">No students match your search in this class</p>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="py-20 bg-white rounded-3xl border border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400">
          <Users size={48} className="mb-4 opacity-20" />
          <p className="font-medium">No assigned classes found</p>
        </div>
      )}
    </div>
  );
};


// --- Management Sub-components ---

const TeacherManagement = () => {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (teacher?: UserProfile) => {
    if (teacher) {
      setEditingTeacher(teacher);
      setFormData({ name: teacher.name, email: teacher.email });
    } else {
      setEditingTeacher(null);
      setFormData({ name: '', email: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingTeacher) {
        await updateDoc(doc(db, 'users', editingTeacher.uid), {
          name: formData.name,
          email: formData.email
        });
      } else {
        const teacherRef = doc(collection(db, 'users'));
        await setDoc(teacherRef, {
          uid: teacherRef.id,
          name: formData.name,
          email: formData.email,
          role: 'teacher'
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, editingTeacher ? OperationType.UPDATE : OperationType.WRITE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
      <div className="p-6 border-b border-stone-100 flex items-center justify-between">
        <h3 className="font-bold text-stone-900">Faculty Members</h3>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition-all"
        >
          <Plus size={16} /> Add Teacher
        </button>
      </div>
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTeacher ? "Edit Teacher" : "Add New Teacher"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Full Name</label>
            <input 
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Email Address</label>
            <input 
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none"
            />
          </div>
          <button 
            disabled={loading}
            className="w-full h-12 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : editingTeacher ? 'Update Teacher' : 'Create Teacher Profile'}
          </button>
        </form>
      </Modal>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Email</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {teachers.map(teacher => (
              <tr key={teacher.uid} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-stone-900">{teacher.name}</td>
                <td className="px-6 py-4 text-stone-500">{teacher.email}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleOpenModal(teacher)}
                      className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(teacher.uid)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StudentManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '', regNumber: '', email: '', parentName: '', parentContact: '', arrears: '0'
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'students');
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        name: student.name,
        regNumber: student.regNumber.toString(),
        email: student.email,
        parentName: student.parentName,
        parentContact: student.parentContact,
        arrears: student.arrears.toString()
      });
    } else {
      setEditingStudent(null);
      setFormData({ name: '', regNumber: '', email: '', parentName: '', parentContact: '', arrears: '0' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...formData,
        regNumber: parseInt(formData.regNumber),
        arrears: parseInt(formData.arrears)
      };
      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), data);
      } else {
        await addDoc(collection(db, 'students'), data);
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, editingStudent ? OperationType.UPDATE : OperationType.WRITE, 'students');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
      <div className="p-6 border-b border-stone-100 flex items-center justify-between">
        <h3 className="font-bold text-stone-900">Student Registry</h3>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition-all"
        >
          <Plus size={16} /> Add Student
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingStudent ? "Edit Student" : "Add New Student"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Reg Number</label>
              <input type="number" required value={formData.regNumber} onChange={e => setFormData({...formData, regNumber: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Email</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Parent Name</label>
              <input required value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Parent Contact</label>
              <input required value={formData.parentContact} onChange={e => setFormData({...formData, parentContact: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Arrears</label>
            <input type="number" required value={formData.arrears} onChange={e => setFormData({...formData, arrears: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" />
          </div>
          <button disabled={loading} className="w-full h-12 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
            {loading ? 'Saving...' : editingStudent ? 'Update Student' : 'Register Student'}
          </button>
        </form>
      </Modal>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Reg No</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Parent Info</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {students.map(student => (
              <tr key={student.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-stone-400">#{student.regNumber}</td>
                <td className="px-6 py-4 font-semibold text-stone-900">{student.name}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-stone-900">{student.parentName}</span>
                    <span className="text-xs text-stone-500">{student.parentContact}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleOpenModal(student)}
                      className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(student.id)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AllocationManagement = () => {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    className: '', startReg: '', endReg: '', counsellorId: '', coordinatorId: ''
  });

  useEffect(() => {
    const unsubAllocations = onSnapshot(collection(db, 'allocations'), (snapshot) => {
      setAllocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Allocation)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'allocations');
    });
    const unsubTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });
    return () => {
      unsubAllocations();
      unsubTeachers();
    };
  }, []);

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'allocations'), {
        ...formData,
        startReg: parseInt(formData.startReg),
        endReg: parseInt(formData.endReg)
      });
      setIsModalOpen(false);
      setFormData({ className: '', startReg: '', endReg: '', counsellorId: '', coordinatorId: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, 'allocations', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `allocations/${id}`);
    }
  };

  const getTeacherName = (uid: string) => teachers.find(t => t.uid === uid)?.name || 'Unknown';

  return (
    <div className="bg-white rounded-3xl border border-stone-100 overflow-hidden">
      <div className="p-6 border-b border-stone-100 flex items-center justify-between">
        <h3 className="font-bold text-stone-900">Class Allocations</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition-all"
        >
          <Plus size={16} /> New Allocation
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Class Allocation">
        <form onSubmit={handleAddAllocation} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Class Name</label>
            <input required value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" placeholder="e.g. CSE-A 2024" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Start Reg No</label>
              <input type="number" required value={formData.startReg} onChange={e => setFormData({...formData, startReg: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">End Reg No</label>
              <input type="number" required value={formData.endReg} onChange={e => setFormData({...formData, endReg: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Counsellor</label>
            <select required value={formData.counsellorId} onChange={e => setFormData({...formData, counsellorId: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none bg-white">
              <option value="">Select Teacher</option>
              {teachers.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Coordinator</label>
            <select required value={formData.coordinatorId} onChange={e => setFormData({...formData, coordinatorId: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none bg-white">
              <option value="">Select Teacher</option>
              {teachers.map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
            </select>
          </div>
          <button disabled={loading} className="w-full h-12 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
            {loading ? 'Allocating...' : 'Create Allocation'}
          </button>
        </form>
      </Modal>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Class</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Range</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Counsellor</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Coordinator</th>
              <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {allocations.map(alloc => (
              <tr key={alloc.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-6 py-4 font-bold text-stone-900">{alloc.className}</td>
                <td className="px-6 py-4 text-sm text-stone-500">
                  <span className="bg-stone-100 px-2 py-1 rounded-md font-mono">{alloc.startReg}</span>
                  <span className="mx-2">to</span>
                  <span className="bg-stone-100 px-2 py-1 rounded-md font-mono">{alloc.endReg}</span>
                </td>
                <td className="px-6 py-4 text-sm text-stone-900">{getTeacherName(alloc.counsellorId)}</td>
                <td className="px-6 py-4 text-sm text-stone-900">{getTeacherName(alloc.coordinatorId)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => handleDelete(alloc.id)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Student Profile ---

const StudentProfile = () => {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'certifications' | 'feedback'>('certifications');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'students', id), (snapshot) => {
      if (snapshot.exists()) {
        setStudent({ id: snapshot.id, ...snapshot.data() } as Student);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `students/${id}`);
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-stone-300" size={40} /></div>;
  if (!student) return <div>Student not found</div>;

  return (
    <div className="space-y-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-stone-400 hover:text-stone-900 transition-colors font-bold text-sm"
      >
        <ChevronRight className="rotate-180" size={16} /> Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-24 h-24 bg-stone-100 rounded-3xl flex items-center justify-center text-stone-300 mb-4">
                <UserCircle size={64} />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">{student.name}</h2>
              <p className="text-stone-400 font-mono text-sm">Reg No: #{student.regNumber}</p>
            </div>

            <div className="space-y-6">
              <InfoItem label="Email Address" value={student.email} />
              <InfoItem label="Parent Name" value={student.parentName} />
              <InfoItem label="Parent Contact" value={student.parentContact} />
              <div className="pt-4 border-t border-stone-50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Active Arrears</span>
                  <span className={cn("text-lg font-bold", student.arrears > 0 ? "text-red-500" : "text-emerald-500")}>
                    {student.arrears}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tabs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 p-1 bg-stone-200/50 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('certifications')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'certifications' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              )}
            >
              <Award size={18} /> Certifications
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'feedback' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              )}
            >
              <MessageSquare size={18} /> Feedback
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="bg-white rounded-3xl border border-stone-100 shadow-sm min-h-[400px]"
            >
              {activeTab === 'certifications' ? (
                <CertificationTab studentId={student.id} />
              ) : (
                <FeedbackTab studentId={student.id} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string, value: string }) => (
  <div>
    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">{label}</label>
    <p className="text-stone-900 font-medium">{value}</p>
  </div>
);

const CertificationTab = ({ studentId }: { studentId: string }) => {
  const [certs, setCerts] = useState<Certification[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', status: 'in-progress' as const });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'certifications'), where('studentId', '==', studentId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Certification)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'certifications');
    });
    return () => unsubscribe();
  }, [studentId]);

  const handleAddCert = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let fileUrl = '';
      if (file) {
        const storageRef = ref(storage, `certifications/${studentId}/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(uploadResult.ref);
      }

      await addDoc(collection(db, 'certifications'), {
        studentId,
        ...formData,
        fileUrl
      });
      setIsModalOpen(false);
      setFormData({ title: '', status: 'in-progress' });
      setFile(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'certifications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-stone-900">Academic Certifications</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-all"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certs.map(cert => (
          <div key={cert.id} className="p-4 rounded-2xl border border-stone-100 bg-stone-50/50 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl text-stone-400">
                <Award size={20} />
              </div>
              <div>
                <h4 className="font-bold text-stone-900">{cert.title}</h4>
                <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">{cert.status}</p>
              </div>
            </div>
            {cert.fileUrl && (
              <a 
                href={cert.fileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
              >
                <ChevronRight size={20} />
              </a>
            )}
          </div>
        ))}
        {certs.length === 0 && (
          <div className="col-span-full py-12 text-center text-stone-400">
            No certifications added yet.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Certification">
        <form onSubmit={handleAddCert} className="space-y-6">
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-2">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full h-12 px-4 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
              placeholder="e.g., Semester 1 Marksheet"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-2">Status</label>
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full h-12 px-4 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
            >
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-2">Upload File (Optional)</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-stone-900 file:text-white hover:file:bg-stone-800 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Add Certification'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

const FeedbackTab = ({ studentId }: { studentId: string }) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const { profile } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'feedback'), where('studentId', '==', studentId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFeedbacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'feedback');
    });
    return () => unsubscribe();
  }, [studentId]);

  const handleAddFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        studentId,
        teacherId: profile.uid,
        teacherName: profile.name,
        content,
        timestamp: serverTimestamp()
      });
      setIsModalOpen(false);
      setContent('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-stone-900">Teacher Observations</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-all"
        >
          <Plus size={20} />
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Feedback">
        <form onSubmit={handleAddFeedback} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Observation Details</label>
            <textarea 
              required 
              rows={4}
              value={content} 
              onChange={e => setContent(e.target.value)} 
              className="w-full p-4 rounded-xl border border-stone-200 focus:border-emerald-500 outline-none resize-none"
              placeholder="Enter your feedback about the student's performance..."
            />
          </div>
          <button disabled={loading} className="w-full h-12 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
            {loading ? 'Submitting...' : 'Post Feedback'}
          </button>
        </form>
      </Modal>

      <div className="space-y-6">
        {feedbacks.length > 0 ? feedbacks.map(fb => (
          <div key={fb.id} className="relative pl-6 border-l-2 border-stone-100">
            <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-stone-200" />
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-bold text-stone-900">{fb.teacherName}</span>
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                {fb.timestamp?.toDate().toLocaleDateString()}
              </span>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed">{fb.content}</p>
          </div>
        )) : (
          <div className="py-20 flex flex-col items-center justify-center text-stone-300">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">No feedback entries yet</p>
          </div>
        )}
      </div>
    </div>
  );
};
