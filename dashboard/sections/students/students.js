import { db, auth, loadHalaqatList } from '../../firebase.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, where, getDocs, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// تحميل الحلقات عند فتح الصفحة
const halaqat = await loadHalaqatList();
const select = document.getElementById('halaqaSelect');
select.innerHTML = '<option value="">اختر الحلقة...</option>';
halaqat.forEach(h => {
    select.innerHTML += `<option value="${h.id}">${h.name} - (الشيخ: ${h.teacherName})</option>`;
});

document.getElementById('addBtn').addEventListener('click', async () => {
    const parentEmail = document.getElementById('parentEmail').value.trim();
    const parentPass = document.getElementById('parentPass').value;
    const studentName = document.getElementById('studentName').value.trim();
    const halaqaId = select.value;

    if (!parentEmail || !parentPass || !studentName || !halaqaId) {
        return alert("يرجى ملء جميع الحقول");
    }

    try {
        let parentUid;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, parentEmail, parentPass);
            parentUid = userCredential.user.uid;
            await setDoc(doc(db, "parents", parentUid), { email: parentEmail, createdAt: serverTimestamp() });
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                const q = query(collection(db, "parents"), where("email", "==", parentEmail));
                const snap = await getDocs(q);
                if (snap.empty) throw new Error("البريد موجود لكن لا يوجد ولي أمر مسجل");
                parentUid = snap.docs[0].id;
            } else { throw error; }
        }
        await addDoc(collection(db, "students"), {
            name: studentName, parentId: parentUid, halaqaId,
            totalPoints: 0, totalLines: 0, joinDate: serverTimestamp(), isActive: true
        });
        alert(`تمت إضافة ${studentName} بنجاح ✅`);
        document.getElementById('studentName').value = '';
        document.getElementById('parentEmail').value = '';
        document.getElementById('parentPass').value = '';
    } catch (e) { alert("خطأ: " + e.message); }
});