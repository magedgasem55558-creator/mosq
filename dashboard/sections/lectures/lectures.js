import { db } from '../../firebase.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById('addBtn').addEventListener('click', async () => {
    const title = document.getElementById('lectureTitle').value.trim();
    const speaker = document.getElementById('speakerName').value.trim();
    const time = document.getElementById('lectureTime').value;
    if (!title || !speaker || !time) return alert("يرجى ملء جميع الحقول");
    try {
        await addDoc(collection(db, "lectures"), {
            title, speaker, time, createdAt: serverTimestamp()
        });
        alert("تم نشر المحاضرة بنجاح ✅");
        document.getElementById('lectureTitle').value = '';
        document.getElementById('speakerName').value = '';
        document.getElementById('lectureTime').value = '';
    } catch (e) {
        alert("خطأ: " + e.message);
    }
});