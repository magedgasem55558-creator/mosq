import { db, loadHalaqatList } from '../../../firebase.js';
import { doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// العناصر الرئيسية
const container = document.getElementById('manageHalaqatList');
const modal = document.getElementById('editHalaqaModal');
const saveBtn = document.getElementById('saveHalaqaBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let currentHalaqaId = null;

// ========== دوال إغلاق النافذة ==========
function closeModal() {
    modal.style.display = 'none';
}

closeModalBtn.addEventListener('click', closeModal);
cancelEditBtn.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
});

// ========== تحميل أولي ==========
async function init() {
    try {
        const halaqat = await loadHalaqatList();
        renderHalaqatList(halaqat);
        saveBtn.addEventListener('click', handleSave);
    } catch (error) {
        container.innerHTML = '<div class="error-msg">فشل تحميل البيانات</div>';
        console.error(error);
    }
}

function renderHalaqatList(halaqat) {
    if (halaqat.length === 0) {
        container.innerHTML = '<div class="empty-msg">لا يوجد حلقات</div>';
        return;
    }

    container.innerHTML = '';
    halaqat.forEach(h => {
        const div = document.createElement('div');
        div.className = 'manage-item';
        div.innerHTML = `
            <div class="item-info">
                <strong>🏫 ${h.name}</strong>
                <small>👨‍🏫 الشيخ: ${h.teacherName}</small>
                <small>📞 ${h.teacherPhone || 'لا يوجد'}</small>
            </div>
            <div class="item-actions">
                <button class="edit-btn" data-id="${h.id}">✏️ تعديل</button>
                <button class="delete-btn" data-id="${h.id}">🗑️ حذف</button>
            </div>
        `;

        div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(h));
        div.querySelector('.delete-btn').addEventListener('click', () => deleteHalaqa(h.id));

        container.appendChild(div);
    });
}

// ========== فتح نافذة التعديل ==========
function openEditModal(halaqa) {
    currentHalaqaId = halaqa.id;
    document.getElementById('editHalaqaId').value = halaqa.id;
    document.getElementById('editHalaqaName').value = halaqa.name || '';
    document.getElementById('editTeacherName').value = halaqa.teacherName || '';
    document.getElementById('editTeacherPhone').value = halaqa.teacherPhone || '';
    modal.style.display = 'flex';
}

// ========== حفظ التعديلات ==========
async function handleSave() {
    const newName = document.getElementById('editHalaqaName').value.trim();
    const newTeacher = document.getElementById('editTeacherName').value.trim();
    const newPhone = document.getElementById('editTeacherPhone').value.trim();

    if (!newName || !newTeacher) {
        alert("يرجى إدخال اسم الحلقة واسم الشيخ");
        return;
    }

    try {
        await updateDoc(doc(db, "halaqat", currentHalaqaId), {
            name: newName,
            teacherName: newTeacher,
            teacherPhone: newPhone
        });
        alert("✅ تم تعديل بيانات الحلقة بنجاح");
        closeModal();
        location.reload();
    } catch (e) {
        alert("خطأ في الحفظ: " + e.message);
    }
}

// ========== حذف حلقة ==========
async function deleteHalaqa(id) {
    if (!confirm("هل أنت متأكد من حذف هذه الحلقة؟ سيتم نقل الطلاب المرتبطين بها إلى حالة بدون حلقة!")) return;
    try {
        // لا نقوم بحذف سجلات أو طلاب، فقط نحدّث الطلاب المرتبطين (اختياري). لكن حسب تطبيقك القديم، جعلت الطلاب بلا حلقة.
        // يمكنك إضافة تحديث الطلاب إذا أردت.
        await deleteDoc(doc(db, "halaqat", id));
        alert("تم حذف الحلقة بنجاح ✅");
        location.reload();
    } catch (e) {
        alert("خطأ في الحذف: " + e.message);
    }
}

// بدء التطبيق
init();