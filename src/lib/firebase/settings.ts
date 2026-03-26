import { db } from "./config";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

export interface RoomSettings {
  roomId: string;
  enableAdvancedAssignments: boolean; // enable the new assignment features
}

export const getRoomSettings = async (roomId: string): Promise<RoomSettings | null> => {
  try {
    const docRef = doc(db, "roomSettings", roomId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { roomId, ...snap.data() } as RoomSettings;
    }
    return null;
  } catch (error) {
    console.error("Error getting room settings:", error);
    return null;
  }
};

export const updateRoomSettings = async (roomId: string, settings: Partial<RoomSettings>) => {
  try {
    const docRef = doc(db, "roomSettings", roomId);
    await setDoc(docRef, { ...settings, roomId }, { merge: true });
  } catch (error) {
    console.error("Error updating room settings:", error);
    throw error;
  }
};