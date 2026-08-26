import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type GuardRegistration = {
  isDirty: boolean;
  onDiscard: () => void;
};

type UnsavedChangesContextValue = {
  registerGuard: (registration: GuardRegistration) => () => void;
  requestNavigation: (to: string) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<GuardRegistration | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const isDirty = Boolean(registration?.isDirty);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const registerGuard = useCallback((nextRegistration: GuardRegistration) => {
    setRegistration(nextRegistration);
    return () => setRegistration((current: GuardRegistration | null) => current === nextRegistration ? null : current);
  }, []);

  const requestNavigation = useCallback((to: string) => {
    if (isDirty) {
      setPendingPath(to);
      return;
    }
    navigate(to);
  }, [isDirty, navigate]);

  const value = useMemo<UnsavedChangesContextValue>(() => ({ registerGuard, requestNavigation }), [registerGuard, requestNavigation]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <AlertDialog open={pendingPath !== null} onOpenChange={(open: boolean) => { if (!open) setPendingPath(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes in this form. If you leave now, those changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const nextPath = pendingPath; registration?.onDiscard(); setPendingPath(null); if (nextPath) navigate(nextPath); }}>Discard and leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesGuard(registration?: GuardRegistration) {
  const context = useContext(UnsavedChangesContext);
  useEffect(() => {
    if (!context || !registration) return undefined;
    return context.registerGuard(registration);
  }, [context, registration]);
  return context;
}
