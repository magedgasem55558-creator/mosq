import { db, loadAllStudents, loadHalaqatList } from '../firebase.js';
import { doc, updateDoc, deleteDoc, query, collection, where, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const listContainer = document.getElementById('manageStudentsList');
const searchInput = document.getElementById('studentSearchInput');
const modal = document.getElementById('editStudentModal');
const saveBtn = document.getElementById('saveStudentBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const halaqaSelect = document.getElementById('editStudentHalaqa');

let currentStudentId = null;

// إغلاق النافذة
function closeModal() {
    modal.style.display = 'none';
}
closeModalBtn.addEventListener('click', closeModal);
cancelEditBtn.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
});

// تحميل الحلقات
async function init() {
    const halaqat = await loadHalaqatList();
    halaqaSelect.innerHTML = '<option value="">اختر الحلقة...</option>';
    halaqat.forEach(h => {
        halaqaSelect.innerHTML += `<option value="${h.id}">${h.name} - (${h.teacherName})</option>`;
    });

    const allStudents = await loadAllStudents();
    renderStudents(allStudents);

    searchInput.addEventListener('keyup', (e) => {
        renderStudents(allStudents, e.target.value);
    });

    saveBtn.addEventListener('click', handleSave);
}

// عرض الطلاب
function renderStudents(students, filter = '') {
    const filtered = students.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));
    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-msg">لا يوجد طلاب مطابقين</div>';
        return;
    }

    listContainer.innerHTML = '';
    filtered.forEach(student => {
        const div = document.createElement('div');
        div.className = 'manage-item';
        div.innerHTML = `
            <div class="item-info">
                <strong>👨‍🎓 ${student.name}</strong>
                <small>📚 ${student.halaqaName}</small>
                <small>⭐ النقاط: ${student.totalPoints || 0}</small>
                <small>${student.isActive !== false ? '🟢 نشط' : '🔴 غير نشط'}</small>
            </div>
            <div class="item-actions">
                <button class="edit-btn">✏️ تعديل</button>
                <button class="delete-btn">🗑️ حذف</button>
            </div>
        `;
        div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(student));
        div.querySelector('.delete-btn').addEventListener('click', () => deleteStudent(student.id));
        listContainer.appendChild(div);
    });
}

// فتح نافذة التعديل
async function openEditModal(student) {
    currentStudentId = student.id;
    document.getElementById('editStudentId').value = student.id;
    document.getElementById('editStudentName').value = student.name || '';
    document.getElementById('editStudentPoints').value = student.totalPoints || 0;
    document.getElementById('editStudentStatus').value = student.isActive !== false ? 'true' : 'false';

    if (student.halaqaId) {
        halaqaSelect.value = student.halaqaId;
    } else {
        halaqaSelect.value = '';
    }

    // بريد ولي الأمر
    try {
        if (student.parentId) {
            const parentDoc = await getDoc(doc(db, "parents", student.parentId));
            document.getElementById('editParentEmail').value = parentDoc.exists()
                ? (parentDoc.data().email || 'غير معروف')
                : 'غير معروف';
        } else {
            document.getElementById('editParentEmail').value = 'غير مرتبط';
        }
    } catch (e) {
        document.getElementById('editParentEmail').value = 'خطأ';
    }

    modal.style.display = 'flex';
}

// حفظ التعديلات
async function handleSave() {
    const newName = document.getElementById('editStudentName').value.trim();
    const newHalaqaId = halaqaSelect.value;
    const newPoints = parseInt(document.getElementById('editStudentPoints').value) || 0;
    const newStatus = document.getElementById('editStudentStatus').value === 'true';

    if (!newName) {
        alert("يرجى إدخال اسم الطالب");
        return;
    }

    try {
        const updateData = {
            name: newName,
            totalPoints: newPoints,
            isActive: newStatus
        };
        if (newHalaqaId) updateData.halaqaId = newHalaqaId;

        await updateDoc(doc(db, "students", currentStudentId), updateData);
        alert("✅ تم تعديل بيانات الطالب بنجاح");
        closeModal();
        location.reload();
    } catch (e) {
        alert("خطأ في الحفظ: " + e.message);
    }
}

// حذف طالب
async function deleteStudent(id) {
    if (!confirm("متأكد من حذف الطالب وجميع سجلاته؟")) return;
    try {
        const recordsSnap = await getDocs(query(collection(db, "records"), where("studentId", "==", id)));
        for (const rec of recordsSnap.docs) {
            await deleteDoc(doc(db, "records", rec.id));
        }
        await deleteDoc(doc(db, "students", id));
        alert("تم الحذف");
        location.reload();
    } catch (e) {
        alert("خطأ في الحذف: " + e.message);
    }
}

init();
// بعد init() أو في نهاية الملف
document.getElementById('resetAllPointsBtn').addEventListener('click', async () => {
    if (!confirm("⚠️ هل أنت متأكد من تصفير نقاط جميع الطلاب؟ لا يمكن التراجع!")) return;
    try {
        const students = await loadAllStudents();
        const batch = [];
        for (const student of students) {
            batch.push(updateDoc(doc(db, "students", student.id), { totalPoints: 0 }));
        }
        await Promise.all(batch);
        alert("✅ تم تصفير نقاط جميع الطلاب بنجاح");
        location.reload();
    } catch (e) {
        alert("❌ خطأ أثناء التصفير: " + e.message);
    }
});