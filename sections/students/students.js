import { db, auth } from '../../firebase.js';
import { collection, addDoc, query, where, getDocs, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { loadHalaqatList } from '../../firebase.js';

(async () => {
  const halaqaSelect = document.getElementById('halaqaSelect');
  const halaqat = await loadHalaqatList();
  halaqaSelect.innerHTML = '<option value="">اختر الحلقة...</option>';
  halaqat.forEach(h => {
    halaqaSelect.innerHTML += `<option value="${h.id}">${h.name} - (${h.teacherName})</option>`;
  });

  document.getElementById('addBtn').addEventListener('click', async () => {
    const name = document.getElementById('studentName').value.trim();
    const email = document.getElementById('parentEmail').value.trim();
    const pass = document.getElementById('parentPass').value;
    const halaqaId = halaqaSelect.value;
    if (!name || !email || !pass || !halaqaId) {
      alert('يرجى ملء جميع الحقول');
      return;
    }
    try {
      let parentUid;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        parentUid = cred.user.uid;
        await setDoc(doc(db, "parents", parentUid), { email, createdAt: serverTimestamp() });
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          const q = query(collection(db, "parents"), where("email", "==", email));
          const snap = await getDocs(q);
          if (snap.empty) throw new Error("البريد موجود لكن لا يوجد ولي أمر");
          parentUid = snap.docs[0].id;
        } else throw e;
      }
      await addDoc(collection(db, "students"), {
        name, parentId: parentUid, halaqaId,
        totalPoints: 0, totalLines: 0, joinDate: serverTimestamp(), isActive: true
      });
      alert(`تمت إضافة ${name} بنجاح ✅`);
      document.getElementById('studentName').value = '';
      document.getElementById('parentEmail').value = '';
      document.getElementById('parentPass').value = '';
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
  });
})();
