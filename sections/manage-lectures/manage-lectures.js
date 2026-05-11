import { db, loadAllLectures } from '../../firebase.js';
import { doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById('manageLecturesList');
const modal = document.getElementById('editLectureModal');
const saveBtn = document.getElementById('saveLectureBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let currentLectureId = null;

function closeModal() { modal.style.display = 'none'; }
closeModalBtn.addEventListener('click', closeModal);
cancelEditBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

async function init() {
    try {
        const lectures = await loadAllLectures();
        renderLectures(lectures);
        saveBtn.addEventListener('click', handleSave);
    } catch (e) {
        container.innerHTML = '<div class="error-msg">فشل تحميل البيانات</div>';
    }
}

function renderLectures(lectures) {
    if (!lectures.length) {
        container.innerHTML = '<div class="empty-msg">لا توجد محاضرات</div>';
        return;
    }
    container.innerHTML = '';
    lectures.forEach(l => {
        const div = document.createElement('div');
        div.className = 'manage-item';
        div.innerHTML = `
            <div class="item-info">
                <strong>🎤 ${l.title}</strong>
                <small>👨‍🏫 ${l.speaker}</small>
                <small>⏰ ${l.time || 'وقت غير محدد'}</small>
            </div>
            <div class="item-actions">
                <button class="edit-btn">✏️ تعديل</button>
                <button class="delete-btn">🗑️ حذف</button>
            </div>
        `;
        div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(l));
        div.querySelector('.delete-btn').addEventListener('click', () => deleteLecture(l.id));
        container.appendChild(div);
    });
}

function openEditModal(lecture) {
    currentLectureId = lecture.id;
    document.getElementById('editLectureId').value = lecture.id;
    document.getElementById('editLectureTitle').value = lecture.title || '';
    document.getElementById('editLectureSpeaker').value = lecture.speaker || '';
    document.getElementById('editLectureTime').value = lecture.time || '';
    modal.style.display = 'flex';
}

async function handleSave() {
    const title = document.getElementById('editLectureTitle').value.trim();
    const speaker = document.getElementById('editLectureSpeaker').value.trim();
    const time = document.getElementById('editLectureTime').value;

    if (!title || !speaker) {
        alert("يرجى ملء جميع الحقول");
        return;
    }

    try {
        await updateDoc(doc(db, "lectures", currentLectureId), { title, speaker, time });
        alert("✅ تم تعديل المحاضرة بنجاح");
        closeModal();
        location.reload();
    } catch (e) {
        alert("خطأ: " + e.message);
    }
}

async function deleteLecture(id) {
    if (!confirm("حذف المحاضرة؟")) return;
    await deleteDoc(doc(db, "lectures", id));
    alert("تم الحذف");
    location.reload();
}

init();