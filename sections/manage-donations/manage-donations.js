import { db } from '../firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const bankNameInput = document.getElementById('bankName');
const accountNumberInput = document.getElementById('accountNumber');
const transferNameInput = document.getElementById('transferName');
const phoneInput = document.getElementById('phone');
const hadithInput = document.getElementById('hadith');
const updateBtn = document.getElementById('updateBtn');

// تحميل البيانات الحالية
async function loadDonationData() {
    try {
        const docSnap = await getDoc(doc(db, "settings", "donation_info"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            bankNameInput.value = data.bankName || '';
            accountNumberInput.value = data.accountNumber || '';
            transferNameInput.value = data.transferName || '';
            phoneInput.value = data.phone || '';
            hadithInput.value = data.hadith || '';
        }
    } catch (e) {
        console.error("خطأ في تحميل بيانات التبرعات:", e);
    }
}

// حفظ البيانات
updateBtn.addEventListener('click', async () => {
    const bankName = bankNameInput.value.trim();
    const accountNumber = accountNumberInput.value.trim();
    const transferName = transferNameInput.value.trim();
    const phone = phoneInput.value.trim();
    const hadith = hadithInput.value.trim();

    if (!bankName && !accountNumber && !transferName && !phone && !hadith) {
        alert("يرجى ملء حقل واحد على الأقل.");
        return;
    }

    try {
        await setDoc(doc(db, "settings", "donation_info"), {
            bankName,
            accountNumber,
            transferName,
            phone,
            hadith,
            lastUpdated: serverTimestamp()
        }, { merge: true });
        alert("✅ تم تحديث بيانات التبرعات بنجاح");
    } catch (e) {
        alert("❌ خطأ في الحفظ: " + e.message);
    }
});

// تحميل البيانات عند فتح الصفحة
loadDonationData();