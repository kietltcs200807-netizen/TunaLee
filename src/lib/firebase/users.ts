import { db } from "./config";
import { doc, setDoc, getDoc, query, collection, where, getDocs, serverTimestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: any;
  updatedAt: any;
}

export const upsertUserProfile = async (user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null; }) => {
  try {
    const userRef = doc(db, "users", user.uid);
    const existing = await getDoc(userRef);

    const now = serverTimestamp();
    if (existing.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        updatedAt: now,
      }, { merge: true });
    } else {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    console.error("Failed to upsert user profile:", error);
    throw error;
  }
};

export const getUserByUID = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;
    return { uid: userSnap.id, ...userSnap.data() } as UserProfile;
  } catch (error) {
    console.error("Failed to get user profile:", error);
    return null;
  }
};

export const getUsersByUIDs = async (uids: string[]): Promise<UserProfile[]> => {
  try {
    if (uids.length === 0) return [];
    const q = query(collection(db, "users"), where("uid", "in", uids));
    const querySnap = await getDocs(q);
    const users: UserProfile[] = [];
    querySnap.forEach((doc) => {
      users.push({ uid: doc.id, ...doc.data() } as UserProfile);
    });
    return users;
  } catch (error) {
    console.error("Failed to get users by UID list:", error);
    return [];
  }
};
