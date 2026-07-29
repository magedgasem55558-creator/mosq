import { db, loadAllRecords } from '../firebase.js';
import { doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById('manageRecordsList');
const modal = document.getElementById('editRecordModal');
const saveBtn = document.getElementById('saveRecordBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const statusSelect = document.getElementById('editRecordStatus');
const surahFields = document.getElementById('recordSurahFields');

let currentRecordId = null;

// دوال النافذة
function closeModal() { modal.style.display = 'none'; }
closeModalBtn.addEventListener('click', closeModal);
cancelEditBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// إظهار/إخفاء حقول السورة حسب الحالة
statusSelect.addEventListener('change', () => {
    surahFields.style.display = statusSelect.value === 'حاضر' ? 'block' : 'none';
});

async function init() {
    try {
        const records = await loadAllRecords();
        renderRecords(records);
        saveBtn.addEventListener('click', handleSave);
    } catch (e) {
        container.innerHTML = '<div class="error-msg">فشل تحميل البيانات</div>';
    }
}

function renderRecords(records) {
    if (!records.length) {
        container.innerHTML = '<div class="empty-msg">لا توجد سجلات</div>';
        return;
    }
    container.innerHTML = '';
    records.forEach(r => {
        const div = document.createElement('div');
        div.className = 'manage-item';
        div.innerHTML = `
            <div class="item-info">
                <strong>👨‍🎓 ${r.studentName}</strong>
                <small>📅 ${r.date || 'بدون تاريخ'}</small>
                <small>${r.status === 'حاضر' ? `📖 ${r.surah} (${r.fromAyah}-${r.toAyah})` : `❌ ${r.status}`}</small>
                <small>⭐ ${r.grade || '-'}</small>
                <small>📊 نقاط: ${r.pointsGiven || 0} | 📖 أسطر: ${r.linesGiven || 0}</small>
            </div>
            <div class="item-actions">
                <button class="edit-btn">✏️ تعديل</button>
                <button class="delete-btn">🗑️ حذف</button>
            </div>
        `;
        div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(r));
        div.querySelector('.delete-btn').addEventListener('click', () => deleteRecord(r.id));
        container.appendChild(div);
    });
}

function openEditModal(record) {
    currentRecordId = record.id;
    document.getElementById('editRecordId').value = record.id;
    document.getElementById('editRecordStudentName').value = record.studentName || '';
    document.getElementById('editRecordDate').value = record.date || '';
    statusSelect.value = record.status || 'حاضر';
    document.getElementById('editRecordSurah').value = record.surah || '';
    document.getElementById('editRecordFromAyah').value = record.fromAyah || '';
    document.getElementById('editRecordToAyah').value = record.toAyah || '';
    document.getElementById('editRecordPoints').value = record.pointsGiven || 0;
    document.getElementById('editRecordLines').value = record.linesGiven || 0;
    surahFields.style.display = (record.status === 'حاضر') ? 'block' : 'none';
    modal.style.display = 'flex';
}

async function handleSave() {
    const status = statusSelect.value;
    const surah = document.getElementById('editRecordSurah').value.trim();
    const fromAyah = document.getElementById('editRecordFromAyah').value.trim();
    const toAyah = document.getElementById('editRecordToAyah').value.trim();
    const points = parseInt(document.getElementById('editRecordPoints').value) || 0;
    const lines = parseInt(document.getElementById('editRecordLines').value) || 0;

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
        location.reload();
    } catch (e) {
        alert("خطأ: " + e.message);
    }
}

async function deleteRecord(id) {
    if (!confirm("حذف السجل؟")) return;
    await deleteDoc(doc(db, "records", id));
    alert("تم الحذف");
    location.reload();
}

init();