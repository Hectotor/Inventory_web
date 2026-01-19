import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return signOut(auth);
}

export async function getUserRole(userId: string) {
  const snapshot = await getDoc(doc(db, "users", userId));
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  return typeof data.role === "string" ? data.role : null;
}
