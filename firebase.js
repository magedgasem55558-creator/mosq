// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, increment, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC06KKxkehT1uPBT9k-r-d6MmB4RUuVy9Y",
  authDomain: "mosque-system.firebaseapp.com",
  projectId: "mosque-system",
  storageBucket: "mosque-system.firebasestorage.app",
  messagingSenderId: "905816133159",
  appId: "1:905816133159:web:3b95d858815f91780e0802"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// --- صلاحيات المدير ---
export async function checkIfUserIsAdmin(user) {
  const docSnap = await getDoc(doc(db, "users", user.uid));
  if (docSnap.exists() && docSnap.data().role === 'admin') return true;
  throw new Error("not-admin");
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = 'login.html';
}

// --- دوال البيانات (تم تحسين السرعة بشكل فوري) ---

export async function loadHalaqatList() {
  const snap = await getDocs(collection(db, "halaqat"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function loadCurrentEvent() {
  const docSnap = await getDoc(doc(db, "settings", "next_event"));
  return docSnap.exists() ? docSnap.data() : null;
}

export async function loadCurrentKhutba() {
  const docSnap = await getDoc(doc(db, "settings", "next_khutba"));
  return docSnap.exists() ? docSnap.data() : null;
}

export async function loadDonationInfo() {
  const docSnap = await getDoc(doc(db, "settings", "donation_info"));
  return docSnap.exists() ? docSnap.data() : null;
}

// ⚡ جلب الطلاب بطلب واحد مجمع وسريع جداً بدون حلقات بطيئة
export async function loadAllStudents() {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export async function loadStudentsByHalaqa(halaqaId) {
  const q = query(collection(db, "students"), where("halaqaId", "==", halaqaId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ⚡ جلب السجلات بطلب واحد سريع
export async function loadAllRecords() {
  try {
    const q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  } catch (e) {
    // في حال عدم وجود الفهرس (Index) لـ orderBy("timestamp")
    console.warn("جلب السجلات بدون ترتيب لتفادي خطأ الفهرس:", e);
    const snap = await getDocs(collection(db, "records"));
    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  }
}

export async function loadAllLectures() {
  try {
    const q = query(collection(db, "lectures"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const snap = await getDocs(collection(db, "lectures"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}
