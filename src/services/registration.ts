import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type CompanyInput = {
  name: string;
  phone: string;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
};

type AdminUserInput = {
  first_name?: string;
  last_name?: string;
  email: string;
  role: "ADMIN";
};

type RegisterInput = {
  company: CompanyInput;
  admin: AdminUserInput;
  password: string;
  displayName?: string;
};

export async function registerCompanyAdmin({
  company,
  admin,
  password,
  displayName,
}: RegisterInput) {
  const { user } = await createUserWithEmailAndPassword(
    auth,
    admin.email,
    password,
  );

  const companyRef = await addDoc(collection(db, "companies"), {
    name: company.name,
    phone: company.phone,
    street: company.street ?? "",
    postal_code: company.postal_code ?? "",
    city: company.city ?? "",
    country: company.country ?? "",
    is_active: true,
    created_at: serverTimestamp(),
  });

  await setDoc(doc(db, "users", user.uid), {
    company_id: companyRef.id,
    first_name: admin.first_name ?? "",
    last_name: admin.last_name ?? "",
    email: user.email ?? admin.email,
    role: admin.role,
    is_active: true,
    created_at: serverTimestamp(),
  });

  if (displayName?.trim()) {
    await updateProfile(user, { displayName: displayName.trim() });
  }

  return { userId: user.uid, companyId: companyRef.id };
}
