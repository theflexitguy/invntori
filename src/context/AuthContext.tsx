"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AppUser } from "@/lib/types";

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  firebaseUser: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Resolve companyID from localStorage (set during login)
      const companyID = localStorage.getItem("companyID") ?? "";

      if (!companyID) {
        // Authenticated but no company found — still let them through with minimal profile
        // so the dashboard can decide what to show
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          companyID: "",
          isAdmin: false,
          isManager: false,
          managePermissions: [],
          officeIDs: [],
        });
        setLoading(false);
        return;
      }

      try {
        const employeeDoc = await getDoc(
          doc(db, "companies", companyID, "Employees", fbUser.uid)
        );

        if (employeeDoc.exists()) {
          const data = employeeDoc.data();
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: data.name ?? fbUser.displayName,
            companyID,
            isAdmin: data.isAdmin === true,
            isManager: data.isManager === true,
            managePermissions: data.managePermissions ?? [],
            officeIDs: data.officeIDs ?? [],
          });
        } else {
          // Employee doc missing or no permission — create minimal user so we don't
          // boot them back to login on every page load
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            companyID,
            isAdmin: false,
            isManager: false,
            managePermissions: [],
            officeIDs: [],
          });
        }
      } catch {
        // Firestore read failed (likely security rules) — still allow access
        // since Firebase Auth itself succeeded
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          companyID,
          isAdmin: false,
          isManager: false,
          managePermissions: [],
          officeIDs: [],
        });
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  const signOut = async () => {
    localStorage.removeItem("companyID");
    await firebaseSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
