import { db, loadAllStudents, loadHalaqatList } from '../../../firebase.js';

import {
doc,
updateDoc,
deleteDoc,
query,
collection,
where,
getDocs,
getDoc,
writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
العناصر
========================================================= */

const listContainer = document.getElementById('manageStudentsList');
const searchInput = document.getElementById('studentSearchInput');

const modal = document.getElementById('editStudentModal');

const saveBtn = document.getElementById('saveStudentBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const halaqaSelect = document.getElementById('editStudentHalaqa');
const resetPointsBtn = document.getElementById('resetAllPointsBtn');

const totalStudentsCount = document.getElementById('totalStudentsCount');
const activeStudentsCount = document.getElementById('activeStudentsCount');
const inactiveStudentsCount = document.getElementById('inactiveStudentsCount');

/* =========================================================
الحالة
========================================================= */

let currentStudentId = null;
let allStudentsCache = [];
let halaqatMap = {};

let searchTimer = null;

/* =========================================================
إغلاق المودال
========================================================= */

function closeModal() {

if (modal) {
    modal.style.display = 'none';
}

currentStudentId = null;

}

closeModalBtn?.addEventListener('click', closeModal);
cancelEditBtn?.addEventListener('click', closeModal);

window.addEventListener('click', (event) => {

if (event.target === modal) {
    closeModal();
}

});

/* =========================================================
تحديث الإحصائيات
========================================================= */

function updateStatistics() {

const total = allStudentsCache.length;

const active = allStudentsCache.filter(
    student => student.isActive !== false
).length;

const inactive = total - active;


if (totalStudentsCount) {
    totalStudentsCount.textContent = total;
}

if (activeStudentsCount) {
    activeStudentsCount.textContent = active;
}

if (inactiveStudentsCount) {
    inactiveStudentsCount.textContent = inactive;
}

}

/* =========================================================
البحث
========================================================= */

function normalizeArabic(text) {

return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

}

function filterStudents(filter) {

const search = normalizeArabic(filter);

if (!search) {
    return allStudentsCache;
}

return allStudentsCache.filter(student => {

    const name = normalizeArabic(student.name);

    const halaqa = normalizeArabic(student.halaqaName);

    return (
        name.includes(search) ||
        halaqa.includes(search)
    );

});

}

/* =========================================================
عرض الطلاب
========================================================= */

function renderStudents(students) {

if (!listContainer) return;


if (!students.length) {

    listContainer.innerHTML = `
        <div class="empty-msg">
            🔍 لا يوجد طلاب مطابقين للبحث
        </div>
    `;

    return;
}


/*
 * DocumentFragment أسرع من appendChild
 * لكل عنصر مباشرة داخل DOM.
 */

const fragment = document.createDocumentFragment();


students.forEach(student => {

    const div = document.createElement('div');

    div.className = 'manage-item';


    const isActive = student.isActive !== false;


    div.innerHTML = `
        <div class="item-info">

            <strong class="student-name">
                👨‍🎓 ${escapeHtml(student.name || 'بدون اسم')}
            </strong>

            <div class="student-meta">

                <span class="student-badge">
                    📚 ${escapeHtml(student.halaqaName || 'بدون حلقة')}
                </span>

                <span class="student-badge points">
                    ⭐ ${student.totalPoints || 0} نقطة
                </span>

                <span class="student-badge ${isActive ? 'active' : 'inactive'}">
                    ${isActive ? '🟢 نشط' : '🔴 غير نشط'}
                </span>

            </div>

        </div>

        <div class="item-actions">

            <button
                class="edit-btn"
                type="button"
            >
                ✏️ تعديل
            </button>

            <button
                class="delete-btn"
                type="button"
            >
                🗑️ حذف
            </button>

        </div>
    `;


    div.querySelector('.edit-btn')
        ?.addEventListener('click', () => openEditModal(student));


    div.querySelector('.delete-btn')
        ?.addEventListener('click', () => deleteStudent(student));


    fragment.appendChild(div);

});


listContainer.replaceChildren(fragment);

}

/* =========================================================
حماية النصوص
========================================================= */

function escapeHtml(value) {

return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}

/* =========================================================
تحميل الصفحة
========================================================= */

async function init() {

if (!listContainer) return;


try {

    listContainer.innerHTML = `
        <div class="loading">
            جاري تحميل الطلاب...
        </div>
    `;


    /*
     * جلب الحلقات والطلاب بالتوازي
     * بدل الانتظار على كل طلب منفرد.
     */

    const [halaqatResult, studentsResult] = await Promise.all([

        loadHalaqatList().catch(error => {

            console.warn(
                'فشل جلب الحلقات:',
                error
            );

            return [];
        }),

        loadAllStudents()

    ]);


    /* =====================================================
       الحلقات
       ===================================================== */

    halaqatMap = {};


    if (Array.isArray(halaqatResult)) {

        let options =
            '<option value="">اختر الحلقة...</option>';


        halaqatResult.forEach(halaqa => {

            halaqatMap[halaqa.id] = halaqa.name;


            options += `
                <option value="${escapeHtml(halaqa.id)}">
                    ${escapeHtml(halaqa.name)}
                    - (${escapeHtml(halaqa.teacherName || 'غير محدد')})
                </option>
            `;

        });


        if (halaqaSelect) {
            halaqaSelect.innerHTML = options;
        }
    }


    /* =====================================================
       الطلاب
       ===================================================== */

    if (!Array.isArray(studentsResult)) {

        throw new Error(
            'البيانات القادمة من الفايربيس ليست مصفوفة.'
        );
    }


    allStudentsCache = studentsResult.map(student => ({

        ...student,

        halaqaName:
            student.halaqaName ||
            halaqatMap[student.halaqaId] ||
            'بدون حلقة'

    }));


    /* =====================================================
       الإحصائيات
       ===================================================== */

    updateStatistics();


    /* =====================================================
       عرض القائمة
       ===================================================== */

    renderStudents(allStudentsCache);


} catch (error) {

    console.error(
        'تفاصيل الخطأ:',
        error
    );


    let errorMessage =
        error.message ||
        'خطأ غير معروف';


    if (
        errorMessage.includes('permission-denied') ||
        errorMessage.includes(
            'Missing or insufficient permissions'
        )
    ) {

        errorMessage =
            '🔒 تم رفض الوصول! تحقق من قواعد Firestore أو تسجيل الدخول.';
    }


    listContainer.innerHTML = `

        <div class="error-msg">

            ⚠️ تعذر تحميل قائمة الطلاب

            <br>

            <small>
                ${escapeHtml(errorMessage)}
            </small>

        </div>

    `;

}

}

/* =========================================================
البحث الفوري
========================================================= */

searchInput?.addEventListener('input', event => {

clearTimeout(searchTimer);


searchTimer = setTimeout(() => {

    const filtered =
        filterStudents(event.target.value);


    renderStudents(filtered);

}, 80);

});

/* =========================================================
فتح تعديل الطالب
========================================================= */

async function openEditModal(student) {

currentStudentId = student.id;


const idInput =
    document.getElementById('editStudentId');

const nameInput =
    document.getElementById('editStudentName');

const pointsInput =
    document.getElementById('editStudentPoints');

const statusSelect =
    document.getElementById('editStudentStatus');

const parentEmailInput =
    document.getElementById('editParentEmail');


if (idInput) {
    idInput.value = student.id;
}


if (nameInput) {
    nameInput.value = student.name || '';
}


if (pointsInput) {
    pointsInput.value =
        student.totalPoints || 0;
}


if (statusSelect) {

    statusSelect.value =
        student.isActive !== false
            ? 'true'
            : 'false';

}


if (halaqaSelect) {

    halaqaSelect.value =
        student.halaqaId || '';

}


if (modal) {
    modal.style.display = 'flex';
}


/* =====================================================
   بريد ولي الأمر
   ===================================================== */

if (!parentEmailInput) return;


parentEmailInput.value =
    'جاري التحميل...';


if (!student.parentId) {

    parentEmailInput.value =
        'غير مرتبط';

    return;
}


try {

    const parentDoc =
        await getDoc(
            doc(
                db,
                'parents',
                student.parentId
            )
        );


    parentEmailInput.value =
        parentDoc.exists()
            ? (
                parentDoc.data().email ||
                'غير معروف'
            )
            : 'غير معروف';


} catch (error) {

    console.warn(
        'تعذر جلب بريد ولي الأمر:',
        error
    );


    parentEmailInput.value =
        'تعذر الجلب';
}

}

/* =========================================================
حفظ التعديلات
========================================================= */

async function handleSave() {

if (!currentStudentId) return;


const nameInput =
    document.getElementById('editStudentName');

const pointsInput =
    document.getElementById('editStudentPoints');

const statusSelect =
    document.getElementById('editStudentStatus');


const newName =
    nameInput?.value.trim() || '';


const newHalaqaId =
    halaqaSelect?.value || '';


const newPoints =
    parseInt(
        pointsInput?.value,
        10
    ) || 0;


const newStatus =
    statusSelect?.value === 'true';


if (!newName) {

    alert(
        'يرجى إدخال اسم الطالب'
    );

    return;
}


try {

    if (saveBtn) {

        saveBtn.disabled = true;

        saveBtn.innerText =
            'جاري الحفظ...';

    }


    await updateDoc(
        doc(
            db,
            'students',
            currentStudentId
        ),
        {

            name: newName,

            totalPoints: newPoints,

            isActive: newStatus,

            halaqaId:
                newHalaqaId || null

        }
    );


    /*
     * تحديث البيانات محليًا مباشرة
     * بدون إعادة تحميل Firestore.
     */

    const index =
        allStudentsCache.findIndex(
            student =>
                student.id === currentStudentId
        );


    if (index !== -1) {

        allStudentsCache[index] = {

            ...allStudentsCache[index],

            name: newName,

            totalPoints: newPoints,

            isActive: newStatus,

            halaqaId:
                newHalaqaId || null,

            halaqaName:
                halaqatMap[newHalaqaId] ||
                'بدون حلقة'

        };

    }


    updateStatistics();


    const currentSearch =
        searchInput?.value || '';


    renderStudents(
        filterStudents(currentSearch)
    );


    closeModal();


    alert(
        '✅ تم تعديل بيانات الطالب بنجاح'
    );


} catch (error) {

    alert(
        '❌ خطأ في الحفظ: ' +
        error.message
    );


} finally {

    if (saveBtn) {

        saveBtn.disabled = false;

        saveBtn.innerText =
            '💾 حفظ التعديلات';

    }

}

}

saveBtn?.addEventListener(
'click',
handleSave
);

/* =========================================================
حذف الطالب
========================================================= */

async function deleteStudent(student) {

if (
    !confirm(
        `هل أنت متأكد من حذف الطالب (${student.name})؟`
    )
) {
    return;
}


try {

    const batch =
        writeBatch(db);


    const recordsSnap =
        await getDocs(
            query(
                collection(
                    db,
                    'records'
                ),
                where(
                    'studentId',
                    '==',
                    student.id
                )
            )
        );


    recordsSnap.forEach(
        recordDoc => {

            batch.delete(
                recordDoc.ref
            );

        }
    );


    batch.delete(
        doc(
            db,
            'students',
            student.id
        )
    );


    await batch.commit();


    /*
     * حذف الطالب من الكاش
     */

    allStudentsCache =
        allStudentsCache.filter(
            item =>
                item.id !== student.id
        );


    updateStatistics();


    renderStudents(
        filterStudents(
            searchInput?.value || ''
        )
    );


    alert(
        '✅ تم حذف الطالب بنجاح'
    );


} catch (error) {

    alert(
        '❌ خطأ أثناء الحذف: ' +
        error.message
    );

}

}

/* =========================================================
تصفير نقاط الجميع
========================================================= */

async function handleResetAllPoints() {

if (
    !confirm(
        '⚠️ هل أنت متأكد من تصفير نقاط جميع الطلاب؟'
    )
) {
    return;
}


try {

    if (resetPointsBtn) {

        resetPointsBtn.disabled = true;

        resetPointsBtn.innerText =
            'جاري التصفير...';

    }


    /*
     * استخدام الكاش الموجود بدل
     * تحميل الطلاب مرة أخرى.
     */

    const batch =
        writeBatch(db);


    allStudentsCache.forEach(
        student => {

            batch.update(

                doc(
                    db,
                    'students',
                    student.id
                ),

                {
                    totalPoints: 0
                }

            );

        }
    );


    await batch.commit();


    /*
     * تحديث الكاش مباشرة
     */

    allStudentsCache =
        allStudentsCache.map(
            student => ({

                ...student,

                totalPoints: 0

            })
        );


    renderStudents(
        filterStudents(
            searchInput?.value || ''
        )
    );


    alert(
        '✅ تم تصفير النقاط بنجاح'
    );


} catch (error) {

    alert(
        '❌ خطأ أثناء التصفير: ' +
        error.message
    );


} finally {

    if (resetPointsBtn) {

        resetPointsBtn.disabled = false;

        resetPointsBtn.innerText =
            '🔄 تصفير نقاط الجميع';

    }

}

}

resetPointsBtn?.addEventListener(
'click',
handleResetAllPoints
);

/* =========================================================
بدء التشغيل
========================================================= */

if (
document.readyState === 'loading'
) {

document.addEventListener(
    'DOMContentLoaded',
    init
);

} else {

init();

}
