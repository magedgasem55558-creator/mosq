import { db } from '../../firebase.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById('saveBtn').addEventListener('click', async () => {
    const name = document.getElementById('newHalaqaName').value.trim();
    const teacherName = document.getElementById('newTeacherName').value.trim();
    const teacherPhone = document.getElementById('newTeacherPhone').value.trim();
    if (!name || !teacherName || !teacherPhone) return alert("يرجى إكمال كافة البيانات");
    try {
        await addDoc(collection(db, "halaqat"), { name, teacherName, teacherPhone, createdAt: serverTimestamp() });
        alert("تمت إضافة الحلقة بنجاح ✅");
        document.getElementById('newHalaqaName').value = '';
        document.getElementById('newTeacherName').value = '';
        document.getElementById('newTeacherPhone').value = '';
    } catch (e) { alert("خطأ: " + e.message); }
});