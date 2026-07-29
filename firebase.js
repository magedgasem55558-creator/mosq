import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, 
    query, where, serverTimestamp, increment, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut 
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

// نظام المصادقة
export function checkIfUserIsAdmin(user) {
    return getDoc(doc(db, "users", user.uid)).then(docSnap => {
        if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.role !== 'admin') throw new Error("not-admin");
            return true;
        } else {
            throw new Error("no-record");
        }
    });
}

export async function logoutUser() {
    await signOut(auth);
    window.location.href = 'login.html';
}

// دوال جلب البيانات العامة
export async function loadHalaqatList() {
    const querySnapshot = await getDocs(collection(db, "halaqat"));
    const halaqat = [];
    querySnapshot.forEach(doc => halaqat.push({ id: doc.id, ...doc.data() }));
    return halaqat;
}

export async function loadCurrentEvent() {
    const eventDoc = await getDoc(doc(db, "settings", "next_event"));
    return eventDoc.exists() ? eventDoc.data() : null;
}

export async function loadCurrentKhutba() {
    const khutbaDoc = await getDoc(doc(db, "settings", "next_khutba"));
    return khutbaDoc.exists() ? khutbaDoc.data() : null;
}

export async function loadCurrentPrayerTimes() {
    const timesDoc = await getDoc(doc(db, "prayer_times", "today"));
    return timesDoc.exists() ? timesDoc.data() : null;
}

export async function loadAllStudents() {
    const querySnapshot = await getDocs(collection(db, "students"));
    const students = [];
    for (const docSnap of querySnapshot.docs) {
        const student = docSnap.data();
        student.id = docSnap.id;
        if (student.halaqaId) {
            const halaqaDoc = await getDoc(doc(db, "halaqat", student.halaqaId));
            student.halaqaName = halaqaDoc.exists() ? halaqaDoc.data().name : 'بدون حلقة';
        } else {
            student.halaqaName = 'بدون حلقة';
        }
        students.push(student);
    }
    return students;
}

export async function loadAllRecords() {
    const q = query(collection(db, "records"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    const records = [];
    for (const docSnap of querySnapshot.docs) {
        const record = docSnap.data();
        record.id = docSnap.id;
        if (record.studentId) {
            const studentDoc = await getDoc(doc(db, "students", record.studentId));
            record.studentName = studentDoc.exists() ? studentDoc.data().name : 'طالب محذوف';
        } else {
            record.studentName = 'طالب غير معروف';
        }
        records.push(record);
    }
    return records;
}

export async function loadAllLectures() {
    const q = query(collection(db, "lectures"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const lectures = [];
    querySnapshot.forEach(doc => lectures.push({ id: doc.id, ...doc.data() }));
    return lectures;
}