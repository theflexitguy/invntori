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

      try {
        // Find which company this user belongs to
        const userDoc = await getDoc(doc(db, "users", fbUser.uid));
        let companyID = userDoc.exists() ? (userDoc.data().companyID as string) : "";

        // Fallback: check localStorage for persisted companyID
        if (!companyID) {
          companyID = localStorage.getItem("companyID") ?? "";
        }

        if (!companyID) {
          setUser(null);
          setLoading(false);
          return;
        }

        const employeeDoc = await getDoc(
          doc(db, "companies", companyID, "Employees", fbUser.uid)
        );

        if (!employeeDoc.exists()) {
          setUser(null);
          setLoading(false);
          return;
        }

        const data = employeeDoc.data();
        const appUser: AppUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: data.name ?? fbUser.displayName,
          companyID,
          isAdmin: data.isAdmin === true,
          isManager: data.isManager === true,
          managePermissions: data.managePermissions ?? [],
          officeIDs: data.officeIDs ?? [],
        };

        localStorage.setItem("companyID", companyID);
        setUser(appUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  const signOut = async () => {
    localStorage.removeItem("companyID");
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
