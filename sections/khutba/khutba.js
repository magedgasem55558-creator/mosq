import { db, loadCurrentKhutba } from '../../firebase.js';
import { doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const khutba = await loadCurrentKhutba();
if (khutba) {
    document.getElementById('khutbaTitle').value = khutba.title || '';
    document.getElementById('khutbaImam').value = khutba.imam || '';
}

document.getElementById('updateBtn').addEventListener('click', async () => {
    const title = document.getElementById('khutbaTitle').value.trim();
    const imam = document.getElementById('khutbaImam').value.trim();
    if (!title || !imam) return alert("يرجى ملء جميع الحقول");
    try {
        await setDoc(doc(db, "settings", "next_khutba"), { title, imam, lastUpdated: serverTimestamp() });
        alert("تم تحديث بيانات الخطبة بنجاح ✅");
    } catch (e) { alert("خطأ: " + e.message); }
});

document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (!confirm("هل أنت متأكد من حذف خطبة الجمعة الحالية؟")) return;
    try {
        await deleteDoc(doc(db, "settings", "next_khutba"));
        alert("تم حذف الخطبة بنجاح ✅");
        document.getElementById('khutbaTitle').value = '';
        document.getElementById('khutbaImam').value = '';
    } catch (e) { alert("خطأ: " + e.message); }
});