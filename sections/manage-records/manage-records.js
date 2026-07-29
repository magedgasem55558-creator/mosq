import { db, loadAllRecords } from '../../../firebase.js';
import { doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// عناصر الواجهة
const container = document.getElementById('manageRecordsList');
const modal = document.getElementById('editRecordModal');
const saveBtn = document.getElementById('saveRecordBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const statusSelect = document.getElementById('editRecordStatus');
const surahFields = document.getElementById('recordSurahFields');

let currentRecordId = null;
let isSaveListenerAttached = false;

// ==========================================
// 1. إدارة النافذة المنبثقة والأحداث الآمنة
// ==========================================
function closeModal() { 
    if (modal) modal.style.display = 'none'; 
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { 
    if (e.target === modal) closeModal(); 
});

if (statusSelect && surahFields) {
    statusSelect.addEventListener('change', () => {
        surahFields.style.display = statusSelect.value === 'حاضر' ? 'block' : 'none';
    });
}

// ==========================================
// 2. التهيئة وجلب البيانات
// ==========================================
async function init() {
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading">جاري تحميل السجلات...</div>';

        // 1. جلب السجلات من firebase.js
        const rawRecords = await loadAllRecords();

        if (!Array.isArray(rawRecords)) {
            throw new Error("البيانات القادمة من loadAllRecords ليست مصفوفة.");
        }

        if (rawRecords.length === 0) {
            container.innerHTML = '<div class="empty-msg">لا توجد سجلات حالياً</div>';
            return;
        }

        // 2. جلب أسماء الطلاب بآلية آمنة لا توقف الصفحة عند فشل عنصر واحد
        const recordsWithNames = await Promise.all(
            rawRecords.map(async (record) => {
                if (record.studentName) return record; // الاسم موجود مسبقاً
                
                if (record.studentId) {
                    try {
                        const studentDoc = await getDoc(doc(db, "students", record.studentId));
                        if (studentDoc.exists()) {
                            return { ...record, studentName: studentDoc.data().name || "طالب بدون اسم" };
                        }
                    } catch (err) {
                        console.warn(`تعذر جلب اسم الطالب للـ ID: ${record.studentId}`, err);
                    }
                }
                return { ...record, studentName: "طالب غير معروف" };
            })
        );

        // 3. عرض السجلات
        renderRecords(recordsWithNames);

        // 4. ربط زر الحفظ مرة واحدة فقط
        if (saveBtn && !isSaveListenerAttached) {
            saveBtn.addEventListener('click', handleSave);
            isSaveListenerAttached = true;
        }

    } catch (e) {
        console.error("خطأ أثناء تحميل البيانات:", e);
        container.innerHTML = `
            <div class="error-msg" style="color: red; padding: 15px; text-align: center;">
                ❌ حدث خطأ أثناء تحميل السجلات:<br>
                <small>${e.message || e}</small>
            </div>`;
    }
}

// ==========================================
// 3. عرض السجلات داخل القائمة
// ==========================================
function renderRecords(records) {
    container.innerHTML = '';

    records.forEach(r => {
        const div = document.createElement('div');
        div.className = 'manage-item';
        div.innerHTML = `
            <div class="item-info">
                <strong>👨‍🎓 ${r.studentName}</strong>
                <small>📅 ${r.date || 'بدون تاريخ'}</small>
                <small>${r.status === 'حاضر' ? `📖 ${r.surah || 'غير محددة'} (${r.fromAyah || '0'}-${r.toAyah || '0'})` : `❌ ${r.status}`}</small>
                <small>⭐ ${r.grade || '-'}</small>
                <small>📊 نقاط: ${r.pointsGiven || 0} | 📖 أسطر: ${r.linesGiven || 0}</small>
            </div>
            <div class="item-actions">
                <button class="edit-btn">✏️ تعديل</button>
                <button class="delete-btn">🗑️ حذف</button>
            </div>
        `;

        const editBtn = div.querySelector('.edit-btn');
        const deleteBtn = div.querySelector('.delete-btn');

        if (editBtn) editBtn.addEventListener('click', () => openEditModal(r));
        if (deleteBtn) deleteBtn.addEventListener('click', () => deleteRecord(r.id));

        container.appendChild(div);
    });
}

// ==========================================
// 4. فتح نافذة التعديل
// ==========================================
function openEditModal(record) {
    if (!modal) return;
    currentRecordId = record.id;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('editRecordId', record.id);
    setVal('editRecordStudentName', record.studentName || 'طالب غير معروف');
    setVal('editRecordDate', record.date || '');
    setVal('editRecordSurah', record.surah || '');
    setVal('editRecordFromAyah', record.fromAyah || '');
    setVal('editRecordToAyah', record.toAyah || '');
    setVal('editRecordPoints', record.pointsGiven || 0);
    setVal('editRecordLines', record.linesGiven || 0);

    if (statusSelect) statusSelect.value = record.status || 'حاضر';
    if (surahFields) surahFields.style.display = (record.status === 'حاضر') ? 'block' : 'none';

    modal.style.display = 'flex';
}

// ==========================================
// 5. حفظ التعديلات
// ==========================================
async function handleSave() {
    if (!currentRecordId) return;

    const status = statusSelect ? statusSelect.value : 'حاضر';
    const surah = (document.getElementById('editRecordSurah')?.value || '').trim();
    const fromAyah = (document.getElementById('editRecordFromAyah')?.value || '').trim();
    const toAyah = (document.getElementById('editRecordToAyah')?.value || '').trim();
    const points = parseInt(document.getElementById('editRecordPoints')?.value) || 0;
    const lines = parseInt(document.getElementById('editRecordLines')?.value) || 0;

    try {
        await updateDoc(doc(db, "records", currentRecordId), {
            status,
            surah: status === 'حاضر' ? surah : status,
            fromAyah: fromAyah || "0",
            toAyah: toAyah || "0",
            pointsGiven: points,
            linesGiven: lines
        });

        alert("تم تحديث السجل ✅");
        closeModal();
        init(); 
    } catch (e) {
        alert("خطأ أثناء الحفظ: " + e.message);
    }
}

// ==========================================
// 6. حذف السجل
// ==========================================
async function deleteRecord(id) {
    if (!confirm("هل أنت تأكد من حذف هذا السجل؟")) return;
    
    try {
        await deleteDoc(doc(db, "records", id));
        alert("تم الحذف بنجاح ✅");
        init(); 
    } catch (e) {
        alert("خطأ أثناء الحذف: " + e.message);
    }
}

// تشغيل بعد اكتمال تحميل DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
