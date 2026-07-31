import { db, auth, loadHalaqatList } from '../../firebase.js';
import { collection, addDoc, query, where, getDocs, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

(async () => {
  const halaqaSelect = document.getElementById('halaqaSelect');
  const addBtn = document.getElementById('addBtn');

  // جلب الحلقات وتعبئة القائمة
  try {
    const halaqat = await loadHalaqatList();
    if (halaqaSelect) {
      halaqaSelect.innerHTML = '<option value="">اختر الحلقة...</option>';
      halaqat.forEach(h => {
        halaqaSelect.innerHTML += `<option value="${h.id}">${h.name} - (${h.teacherName || 'بدون معلم'})</option>`;
      });
    }
  } catch (err) {
    console.error("❌ خطأ أثناء تحميل الحلقات:", err);
    if (halaqaSelect) halaqaSelect.innerHTML = '<option value="">❌ تعذر تحميل الحلقات</option>';
  }

  // حدث عند النقر على زر الحفظ
  if (addBtn) {
    addBtn.addEventListener('click', async (e) => {
      e.preventDefault(); // 👈 منع إعادة التوجيه والتحديث الافتراضي للمتصفح

      const nameInput = document.getElementById('studentName');
      const emailInput = document.getElementById('parentEmail');
      const passInput = document.getElementById('parentPass');

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const pass = passInput ? passInput.value : '';
      const halaqaId = halaqaSelect ? halaqaSelect.value : '';

      if (!name || !email || !pass || !halaqaId) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      // تعطيل الزر أثناء المعالجة
      const originalBtnText = addBtn.innerText;
      addBtn.disabled = true;
      addBtn.innerText = '⏳ جاري الحفظ...';

      try {
        let parentUid;

        // 1. إنشاء حساب ولي الأمر أو جلب ID الحساب الموجد مسبقاً
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, pass);
          parentUid = cred.user.uid;
          await setDoc(doc(db, "parents", parentUid), { 
            email, 
            createdAt: serverTimestamp() 
          });
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') {
            const q = query(collection(db, "parents"), where("email", "==", email));
            const snap = await getDocs(q);
            if (snap.empty) {
              throw new Error("البريد الإلكتروني موجود مسبقاً لكن لا يوجد سجل لولي الأمر.");
            }
            parentUid = snap.docs[0].id;
          } else {
            throw e;
          }
        }

        // 2. إضافة الطالب في Firestore
        await addDoc(collection(db, "students"), {
          name,
          parentId: parentUid,
          halaqaId,
          totalPoints: 0,
          totalLines: 0,
          joinDate: serverTimestamp(),
          isActive: true
        });

        alert(`تمت إضافة الطالب (${name}) بنجاح ✅`);

        // تفريغ الحقول بعد الحفظ بنجاح
        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        if (halaqaSelect) halaqaSelect.value = '';

      } catch (e) {
        console.error("❌ خطأ أثناء إضافة الطالب:", e);
        alert('خطأ: ' + e.message);
      } finally {
        // إعادة الزر لحالته الطبيعية
        addBtn.disabled = false;
        addBtn.innerText = originalBtnText;
      }
    });
  }
})();
