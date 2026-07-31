import { db, auth, loadHalaqatList } from '../../firebase.js';
import { collection, addDoc, query, where, getDocs, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// دالة إنشاء حساب لولي الأمر عبر تطبيق ثانوي مؤقت حتى لا يتسبب في قطع جلسة الأدمن
async function createParentAccountSecondary(email, password) {
  // استخدام نفس إعدادات التطبيق الرئيسي
  const firebaseConfig = auth.app.options;
  
  // إنشاء تطبيق فرعي باسم عشوائي مؤقت
  const secondaryAppName = `SecondaryApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    
    // تسجيل الخروج وتنظيف التطبيق الفرعي فور الانتهاء
    await secondaryAuth.signOut();
    
    return uid;
  } catch (err) {
    throw err;
  }
}

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
      const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
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

        // 1. إنشاء حساب ولي الأمر بواسطة التطبيق الثانوي لتفادي خروج الأدمن
        try {
          parentUid = await createParentAccountSecondary(email, pass);
          
          // حفظ مستند ولي الأمر في قاعدة البيانات الرئيسية Firestore
          await setDoc(doc(db, "parents", parentUid), { 
            email, 
            createdAt: serverTimestamp() 
          });
          
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') {
            // إذا كان البريد موجوداً مسبقاً، نربط الطالب بحساب ولي الأمر الموجود
            const q = query(collection(db, "parents"), where("email", "==", email));
            const snap = await getDocs(q);
            if (snap.empty) {
              throw new Error("البريد الإلكتروني موجود مسبقاً في نظام Auth لكن لا يوجد له سجل في قاعدة البيانات.");
            }
            parentUid = snap.docs[0].id;
          } else {
            throw e;
          }
        }

        // 2. إضافة الطالب إلى Firestore مع ربطه بـ parentUid وحلقة الطالب
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
