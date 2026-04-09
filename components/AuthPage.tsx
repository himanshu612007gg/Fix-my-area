'use client';

import { type ReactNode, useState } from 'react';
import { ShieldCheck, Building2, Users, ArrowRight, LockKeyhole, Sparkles } from 'lucide-react';
import {
  AuthMode,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  authenticateAdmin,
  authenticateCitizenPassword,
  authenticateAuthority,
  authenticateWithGoogle,
} from '@/lib/db';
import {
  getFirebaseAuthErrorCode,
  getFirebaseAuthErrorMessage,
  signInWithFirebaseEmailPassword,
  signInWithFirebaseGooglePopup,
  signUpWithFirebaseEmailPassword,
} from '@/lib/firebase-auth';
import { isFirebaseConfigured } from '@/lib/firebase';

interface AuthPageProps {
  onAuthSuccess: () => void | Promise<void>;
}

type PortalType = 'citizen' | 'authority' | 'admin';

interface CitizenFormState {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  loading: boolean;
  error: string;
}

interface AuthorityFormState {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  loading: boolean;
  error: string;
}

interface AdminFormState {
  username: string;
  password: string;
  loading: boolean;
  error: string;
}

const portalOptions: Array<{
  value: PortalType;
  label: string;
  eyebrow: string;
}> = [
  { value: 'citizen', label: 'Citizen Login', eyebrow: 'Public portal' },
  { value: 'authority', label: 'Authority Login', eyebrow: 'Field desk' },
  { value: 'admin', label: 'Admin Console', eyebrow: 'Control room' },
];

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="portal-card rounded-[2rem] border border-border/70 bg-card/90 p-6 xl:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Secure entry</p>
        <h2 className="mt-3 text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-muted/30 p-1">
      {(['signin', 'signup'] as AuthMode[]).map(item => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            mode === item
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:bg-card hover:text-foreground'
          }`}
        >
          {item === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'email' | 'password';
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function ErrorBanner({ error }: { error: string }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
      {error}
    </div>
  );
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [portal, setPortal] = useState<PortalType>('citizen');
  const [citizenForm, setCitizenForm] = useState<CitizenFormState>({
    mode: 'signin',
    name: '',
    email: '',
    password: '',
    loading: false,
    error: '',
  });
  const [authorityForm, setAuthorityForm] = useState<AuthorityFormState>({
    mode: 'signin',
    name: '',
    email: '',
    password: '',
    loading: false,
    error: '',
  });
  const [adminForm, setAdminForm] = useState<AdminFormState>({
    username: '',
    password: '',
    loading: false,
    error: '',
  });

  const firebaseEnabled = isFirebaseConfigured();

  const handleCitizenGoogle = async () => {
    setCitizenForm(prev => ({ ...prev, loading: true, error: '' }));

    try {
      if (!firebaseEnabled) {
        throw new Error('Firebase configuration is missing.');
      }

      const profile = await signInWithFirebaseGooglePopup();
      await authenticateWithGoogle(
        {
          googleId: profile.uid,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
        citizenForm.mode,
      );

      setCitizenForm(prev => ({ ...prev, loading: false }));
      await onAuthSuccess();
    } catch (error) {
      setCitizenForm(prev => ({
        ...prev,
        loading: false,
        error: getFirebaseAuthErrorMessage(error, 'google', 'Citizen authentication failed.'),
      }));
    }
  };

  const handleCitizenPassword = async () => {
    setCitizenForm(prev => ({ ...prev, loading: true, error: '' }));

    try {
      if (!firebaseEnabled) {
        throw new Error('Firebase configuration is missing.');
      }

      if (!citizenForm.email.trim()) {
        throw new Error('Please enter your email address.');
      }

      if (!citizenForm.password || citizenForm.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      if (citizenForm.mode === 'signup' && !citizenForm.name.trim()) {
        throw new Error('Please enter your full name.');
      }

      const profile = citizenForm.mode === 'signup'
        ? await signUpWithFirebaseEmailPassword(citizenForm.email, citizenForm.password, citizenForm.name)
        : await signInWithFirebaseEmailPassword(citizenForm.email, citizenForm.password);

      await authenticateCitizenPassword(
        {
          uid: profile.uid,
          email: profile.email,
          name: citizenForm.mode === 'signup' ? citizenForm.name : profile.name,
        },
        citizenForm.mode,
      );

      setCitizenForm(prev => ({ ...prev, loading: false }));
      await onAuthSuccess();
    } catch (error) {
      setCitizenForm(prev => ({
        ...prev,
        loading: false,
        error: getFirebaseAuthErrorMessage(error, 'password', 'Citizen authentication failed.'),
      }));
    }
  };

  const handleAuthoritySubmit = async () => {
    setAuthorityForm(prev => ({ ...prev, loading: true, error: '' }));

    try {
      if (!firebaseEnabled) {
        throw new Error('Firebase configuration is missing.');
      }

      if (!authorityForm.email.trim()) {
        throw new Error('Please enter your official email address.');
      }

      if (!authorityForm.password || authorityForm.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      if (authorityForm.mode === 'signup' && !authorityForm.name.trim()) {
        throw new Error('Please enter your full name.');
      }

      const profile = authorityForm.mode === 'signup'
        ? await signUpWithFirebaseEmailPassword(authorityForm.email, authorityForm.password, authorityForm.name)
        : await signInWithFirebaseEmailPassword(authorityForm.email, authorityForm.password);

      await authenticateAuthority(
        {
          uid: profile.uid,
          email: profile.email,
          name: authorityForm.mode === 'signup' ? authorityForm.name : profile.name,
        },
        authorityForm.mode,
      );

      setAuthorityForm(prev => ({ ...prev, loading: false }));
      await onAuthSuccess();
    } catch (error) {
      setAuthorityForm(prev => ({
        ...prev,
        loading: false,
        error: getFirebaseAuthErrorMessage(error, 'password', 'Authority authentication failed.'),
      }));
    }
  };

  const handleAdminSubmit = async () => {
    setAdminForm(prev => ({ ...prev, loading: true, error: '' }));

    try {
      if (!firebaseEnabled) {
        throw new Error('Firebase configuration is missing.');
      }

      if (adminForm.username.trim() !== ADMIN_USERNAME || adminForm.password !== ADMIN_PASSWORD) {
        throw new Error('Invalid admin credentials.');
      }

      let profile;

      try {
        profile = await signInWithFirebaseEmailPassword(ADMIN_EMAIL, adminForm.password);
      } catch (error) {
        const firebaseCode = getFirebaseAuthErrorCode(error);

        if (firebaseCode !== 'auth/user-not-found' && firebaseCode !== 'auth/invalid-credential') {
          throw error;
        }

        profile = await signUpWithFirebaseEmailPassword(ADMIN_EMAIL, adminForm.password, ADMIN_USERNAME);
      }

      await authenticateAdmin(profile);
      setAdminForm(prev => ({ ...prev, loading: false }));
      await onAuthSuccess();
    } catch (error) {
      setAdminForm(prev => ({
        ...prev,
        loading: false,
        error: getFirebaseAuthErrorMessage(error, 'password', 'Admin sign-in failed.'),
      }));
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8 md:py-10">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="portal-card rounded-[2.25rem] border border-border/70 bg-card/90 p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            <ShieldCheck className="h-4 w-4" />
            National civic access
          </div>

          <h1 className="portal-title mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            Secure entry for citizens, district teams, and the national control room.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
            Public users can report issues through Google or email login. Government authorities use Firebase email
            authentication and are granted protected access only after admin approval. Platform admins manage those
            approvals from a dedicated control panel.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
              <Users className="h-8 w-8 text-primary" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">Citizen access</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Citizens authenticate with Google or email/password and immediately access the reporting experience.
              </p>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
              <Building2 className="h-8 w-8 text-primary" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">Authority review</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Staff accounts use Firebase email and password, then wait for approval before entering protected flows.
              </p>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
              <LockKeyhole className="h-8 w-8 text-primary" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">Admin validation</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A separate admin workspace reviews pending authority accounts and controls protected-route access.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background/70 px-4 py-2">Firebase Auth</span>
            <span className="rounded-full border border-border/70 bg-background/70 px-4 py-2">Firestore approval state</span>
            <span className="rounded-full border border-border/70 bg-background/70 px-4 py-2">Protected dashboards</span>
          </div>
        </section>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-[2rem] border border-border/70 bg-card/85 p-2">
            {portalOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPortal(option.value)}
                className={`rounded-[1.25rem] px-4 py-3 text-left transition ${
                  portal === option.value
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-70">{option.eyebrow}</div>
                <div className="mt-1 text-sm font-medium">{option.label}</div>
              </button>
            ))}
          </div>

          {portal === 'citizen' && (
            <AuthShell
              title="Public sign-in"
              subtitle="Use Google or email/password to enter the citizen reporting portal. New public accounts are provisioned on first sign-up."
            >
              <div className="space-y-5">
                <ModeToggle
                  mode={citizenForm.mode}
                  onChange={mode => setCitizenForm(prev => ({ ...prev, mode, loading: false, error: '' }))}
                />

                {citizenForm.mode === 'signup' && (
                  <TextInput
                    label="Full name"
                    value={citizenForm.name}
                    onChange={value => setCitizenForm(prev => ({ ...prev, name: value }))}
                    placeholder="Aarav Sharma"
                  />
                )}

                <TextInput
                  label="Email"
                  type="email"
                  value={citizenForm.email}
                  onChange={value => setCitizenForm(prev => ({ ...prev, email: value }))}
                  placeholder="you@example.com"
                />

                <TextInput
                  label="Password"
                  type="password"
                  value={citizenForm.password}
                  onChange={value => setCitizenForm(prev => ({ ...prev, password: value }))}
                  placeholder="Enter your password"
                />

                <ErrorBanner error={citizenForm.error} />

                <button
                  type="button"
                  onClick={() => void handleCitizenPassword()}
                  disabled={!firebaseEnabled || citizenForm.loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {citizenForm.loading
                    ? 'Authenticating...'
                    : citizenForm.mode === 'signin'
                      ? 'Sign in with email'
                      : 'Create account with email'}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <button
                  type="button"
                  onClick={() => void handleCitizenGoogle()}
                  disabled={!firebaseEnabled || citizenForm.loading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3.5 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  {citizenForm.loading
                    ? 'Connecting to Google...'
                    : citizenForm.mode === 'signin'
                      ? 'Continue with Google'
                      : 'Create account with Google'}
                </button>

                {!firebaseEnabled && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">Firebase environment variables are required before auth can work.</p>
                )}
              </div>
            </AuthShell>
          )}

          {portal === 'authority' && (
            <AuthShell
              title="Authority sign-in"
              subtitle="Use your official authority account. Newly registered authority users are created in Firestore with pending approval and cannot enter protected dashboards until validated by admin."
            >
              <div className="space-y-5">
                <ModeToggle
                  mode={authorityForm.mode}
                  onChange={mode => setAuthorityForm(prev => ({ ...prev, mode, loading: false, error: '' }))}
                />

                {authorityForm.mode === 'signup' && (
                  <TextInput
                    label="Full name"
                    value={authorityForm.name}
                    onChange={value => setAuthorityForm(prev => ({ ...prev, name: value }))}
                    placeholder="Aarav Sharma"
                  />
                )}

                <TextInput
                  label="Official email"
                  type="email"
                  value={authorityForm.email}
                  onChange={value => setAuthorityForm(prev => ({ ...prev, email: value }))}
                  placeholder="department@gov.example"
                />

                <TextInput
                  label="Password"
                  type="password"
                  value={authorityForm.password}
                  onChange={value => setAuthorityForm(prev => ({ ...prev, password: value }))}
                  placeholder="Enter your password"
                />

                <ErrorBanner error={authorityForm.error} />

                <button
                  type="button"
                  onClick={() => void handleAuthoritySubmit()}
                  disabled={authorityForm.loading || !firebaseEnabled}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authorityForm.loading
                    ? 'Authenticating...'
                    : authorityForm.mode === 'signin'
                      ? 'Sign in as authority'
                      : 'Create authority account'}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                  <p className="font-medium text-foreground">Approval workflow</p>
                  <p className="mt-2">
                    After sign-up, your account is marked as pending in Firestore. An admin must approve it before
                    authority-only routes unlock.
                  </p>
                </div>
              </div>
            </AuthShell>
          )}

          {portal === 'admin' && (
            <AuthShell
              title="Admin control"
              subtitle="Temporary admin entry for approval management. It still depends on Firebase Email/Password auth so the admin can read and update Firestore."
            >
              <div className="space-y-5">
                <TextInput
                  label="Username"
                  value={adminForm.username}
                  onChange={value => setAdminForm(prev => ({ ...prev, username: value }))}
                  placeholder="Enter admin username"
                />
                <TextInput
                  label="Password"
                  type="password"
                  value={adminForm.password}
                  onChange={value => setAdminForm(prev => ({ ...prev, password: value }))}
                  placeholder="Enter admin password"
                />
                <ErrorBanner error={adminForm.error} />

                <button
                  type="button"
                  onClick={() => void handleAdminSubmit()}
                  disabled={adminForm.loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adminForm.loading ? 'Opening admin panel...' : 'Enter admin panel'}
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
            </AuthShell>
          )}
        </div>
      </div>
    </div>
  );
}
