import { db, loadAllStudents, loadHalaqatList } from '../../../firebase.js';
import { 
  doc, updateDoc, deleteDoc, query, collection, where, getDocs, getDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const listContainer = document.getElementById('manageStudentsList');
const searchInput = document.getElementById('studentSearchInput');
const modal = document.getElementById('editStudentModal');
const saveBtn = document.getElementById('saveStudentBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const halaqaSelect = document.getElementById('editStudentHalaqa');
const resetPointsBtn = document.getElementById('resetAllPointsBtn');

let currentStudentId = null;
let allStudentsCache = [];

function closeModal() {
  if (modal) modal.style.display = 'none';
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeModal);
window.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

async function init() {
  if (!listContainer) return;

  try {
    listContainer.innerHTML = '<div class="loading">جاري تحميل الطلاب...</div>';

    // 1. جلب الحلقات والطلاب معاً
    const halaqat = await loadHalaqatList().catch(err => {
      console.warn("فشل جلب الحلقات:", err);
      return [];
    });

    // إنشاء الخريطة
    const halaqatMap = {};
    if (halaqaSelect && Array.isArray(halaqat)) {
      let options = '<option value="">اختر الحلقة...</option>';
      halaqat.forEach(h => {
        halaqatMap[h.id] = h.name;
        options += `<option value="${h.id}">${h.name} - (${h.teacherName || 'غير محدد'})</option>`;
      });
      halaqaSelect.innerHTML = options;
    }

    // 2. جلب الطلاب
    const rawStudents = await loadAllStudents();

    if (!Array.isArray(rawStudents)) {
      throw new Error("البيانات القادمة من الفايربيس ليست مصفوفة.");
    }

    // ربط اسم الحلقة مع كل طالب
    allStudentsCache = rawStudents.map(student => ({
      ...student,
      halaqaName: student.halaqaName || halaqatMap[student.halaqaId] || 'بدون حلقة'
    }));

    // 3. عرض الطلاب
    renderStudents(allStudentsCache);

    // 4. ربط الأحداث
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderStudents(allStudentsCache, e.target.value);
      });
    }

    if (saveBtn) saveBtn.onclick = handleSave;
    if (resetPointsBtn) resetPointsBtn.onclick = handleResetAllPoints;

  } catch (e) {
    console.error("تفاصيل الخطأ:", e);
    
    // إظهار سبب المعاوقة بوضوح للمطور في الواجهة
    let errorMessage = e.message || "خطأ غير معروف";
    if (errorMessage.includes("permission-denied") || errorMessage.includes("Missing or insufficient permissions")) {
      errorMessage = "🔒 تم رفض الوصول! تحقق من قواعد الأمان (Firestore Rules) أو تسجيل الدخول.";
    }

    listContainer.innerHTML = `
      <div class="empty-msg" style="color:red; text-align:center; padding: 20px; line-height:1.6;">
        ⚠️ تعذر تحميل قائمة الطلاب<br>
        <small style="background:#fee2e2; padding:5px 10px; border-radius:4px; display:inline-block; margin-top:8px;">
          ${errorMessage}
        </small>
      </div>`;
  }
}

function renderStudents(students, filter = '') {
  if (!listContainer) return;

  const filtered = students.filter(s => 
    s.name && s.name.toLowerCase().includes(filter.toLowerCase().trim())
  );

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

    div.querySelector('.edit-btn')?.addEventListener('click', () => openEditModal(student));
    div.querySelector('.delete-btn')?.addEventListener('click', () => deleteStudent(student));

    listContainer.appendChild(div);
  });
}

async function openEditModal(student) {
  currentStudentId = student.id;
  
  const idInput = document.getElementById('editStudentId');
  const nameInput = document.getElementById('editStudentName');
  const pointsInput = document.getElementById('editStudentPoints');
  const statusSelect = document.getElementById('editStudentStatus');
  const parentEmailInput = document.getElementById('editParentEmail');

  if (idInput) idInput.value = student.id;
  if (nameInput) nameInput.value = student.name || '';
  if (pointsInput) pointsInput.value = student.totalPoints || 0;
  if (statusSelect) statusSelect.value = student.isActive !== false ? 'true' : 'false';
  if (halaqaSelect) halaqaSelect.value = student.halaqaId || '';

  if (modal) modal.style.display = 'flex';

  if (parentEmailInput) {
    parentEmailInput.value = 'جاري التحميل...';
    if (!student.parentId) {
      parentEmailInput.value = 'غير مرتبط';
    } else {
      try {
        const parentDoc = await getDoc(doc(db, "parents", student.parentId));
        parentEmailInput.value = parentDoc.exists() ? (parentDoc.data().email || 'غير معروف') : 'غير معروف';
      } catch (e) {
        parentEmailInput.value = 'تعذر الجلب';
      }
    }
  }
}

async function handleSave() {
  if (!currentStudentId) return;

  const nameInput = document.getElementById('editStudentName');
  const pointsInput = document.getElementById('editStudentPoints');
  const statusSelect = document.getElementById('editStudentStatus');

  const newName = nameInput ? nameInput.value.trim() : '';
  const newHalaqaId = halaqaSelect ? halaqaSelect.value : '';
  const newPoints = parseInt(pointsInput?.value) || 0;
  const newStatus = statusSelect?.value === 'true';

  if (!newName) {
    alert("يرجى إدخال اسم الطالب");
    return;
  }

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = "جاري الحفظ...";
    }

    await updateDoc(doc(db, "students", currentStudentId), {
      name: newName,
      totalPoints: newPoints,
      isActive: newStatus,
      halaqaId: newHalaqaId || null
    });

    alert("✅ تم تعديل بيانات الطالب بنجاح");
    closeModal();
    init();
  } catch (e) {
    alert("خطأ في الحفظ: " + e.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = "💾 حفظ التعديلات";
    }
  }
}

async function deleteStudent(student) {
  if (!confirm(`هل أنت متأكد من حذف الطالب (${student.name})؟`)) return;

  try {
    const batch = writeBatch(db);
    const recordsSnap = await getDocs(query(collection(db, "records"), where("studentId", "==", student.id)));
    recordsSnap.forEach(recDoc => batch.delete(recDoc.ref));
    batch.delete(doc(db, "students", student.id));

    await batch.commit();
    alert("✅ تم الحذف بنجاح");
    init();
  } catch (e) {
    alert("خطأ أثناء الحذف: " + e.message);
  }
}

async function handleResetAllPoints() {
  if (!confirm("⚠️ هل أنت متأكد من تصفير نقاط جميع الطلاب؟")) return;

  try {
    if (resetPointsBtn) resetPointsBtn.disabled = true;
    const students = await loadAllStudents();
    const batch = writeBatch(db);
    students.forEach(s => batch.update(doc(db, "students", s.id), { totalPoints: 0 }));

    await batch.commit();
    alert("✅ تم تصفير النقاط بنجاح");
    init();
  } catch (e) {
    alert("❌ خطأ أثناء التصفير: " + e.message);
  } finally {
    if (resetPointsBtn) resetPointsBtn.disabled = false;
  }
}

// بدء التشغيل
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
