import { db, loadCurrentEvent } from '../../firebase.js';
import { doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// تحميل بيانات الفعالية الحالية
const event = await loadCurrentEvent();
if (event) {
    document.getElementById('eventTitle').value = event.title || '';
    document.getElementById('eventLocation').value = event.location || '';
    if (event.date) document.getElementById('eventDate').value = event.date;
}

// تحديث الفعالية
document.getElementById('updateBtn').addEventListener('click', async () => {
    const title = document.getElementById('eventTitle').value.trim();
    const location = document.getElementById('eventLocation').value.trim();
    const date = document.getElementById('eventDate').value;
    if (!title || !location || !date) return alert("يرجى ملء جميع الحقول");
    try {
        await setDoc(doc(db, "settings", "next_event"), {
            title, location, date, lastUpdated: serverTimestamp()
        });
        alert("تم تحديث الفعالية القادمة بنجاح ✅");
    } catch (e) {
        alert("خطأ: " + e.message);
    }
});

// حذف الفعالية
document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (!confirm("هل أنت متأكد من حذف الفعالية الحالية؟")) return;
    try {
        await deleteDoc(doc(db, "settings", "next_event"));
        alert("تم حذف الفعالية بنجاح ✅");
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventLocation').value = '';
        document.getElementById('eventDate').value = '';
    } catch (e) {
        alert("خطأ: " + e.message);
    }
});