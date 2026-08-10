import { db, loadHalaqatList } from '../../../firebase.js';

import {
doc,
updateDoc,
deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
العناصر
========================================================= */

const container =
document.getElementById('manageHalaqatList');

const modal =
document.getElementById('editHalaqaModal');

const saveBtn =
document.getElementById('saveHalaqaBtn');

const closeModalBtn =
document.getElementById('closeModalBtn');

const cancelEditBtn =
document.getElementById('cancelEditBtn');

const searchInput =
document.getElementById('halaqaSearchInput');

const totalHalaqatCount =
document.getElementById('totalHalaqatCount');

const totalTeachersCount =
document.getElementById('totalTeachersCount');

const halaqatWithPhoneCount =
document.getElementById('halaqatWithPhoneCount');

/* =========================================================
الحالة
========================================================= */

let currentHalaqaId = null;

let allHalaqatCache = [];

let searchTimer = null;

/* =========================================================
حماية النصوص
========================================================= */

function escapeHtml(value) {

return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}

/* =========================================================
توحيد البحث العربي
========================================================= */

function normalizeArabic(text) {

return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

}

/* =========================================================
إغلاق المودال
========================================================= */

function closeModal() {

if (modal) {
    modal.style.display = 'none';
}

currentHalaqaId = null;

}

closeModalBtn?.addEventListener(
'click',
closeModal
);

cancelEditBtn?.addEventListener(
'click',
closeModal
);

window.addEventListener(
'click',
event => {

    if (event.target === modal) {
        closeModal();
    }

}

);

/* =========================================================
الإحصائيات
========================================================= */

function updateStatistics() {

const total =
    allHalaqatCache.length;


/*
 * عدد الشيوخ الفريدين
 */

const teachers =
    new Set(

        allHalaqatCache

            .map(
                h =>
                    normalizeArabic(
                        h.teacherName
                    )
            )

            .filter(Boolean)

    ).size;


/*
 * الحلقات التي لديها رقم
 */

const withPhone =
    allHalaqatCache.filter(
        h =>
            String(
                h.teacherPhone || ''
            ).trim() !== ''
    ).length;


if (totalHalaqatCount) {

    totalHalaqatCount.textContent =
        total;

}


if (totalTeachersCount) {

    totalTeachersCount.textContent =
        teachers;

}


if (halaqatWithPhoneCount) {

    halaqatWithPhoneCount.textContent =
        withPhone;

}

}

/* =========================================================
البحث
========================================================= */

function filterHalaqat(filter) {

const search =
    normalizeArabic(filter);


if (!search) {

    return allHalaqatCache;

}


return allHalaqatCache.filter(
    halaqa => {

        const name =
            normalizeArabic(
                halaqa.name
            );

        const teacher =
            normalizeArabic(
                halaqa.teacherName
            );

        const phone =
            normalizeArabic(
                halaqa.teacherPhone
            );


        return (

            name.includes(search) ||

            teacher.includes(search) ||

            phone.includes(search)

        );

    }
);

}

/* =========================================================
عرض الحلقات
========================================================= */

function renderHalaqatList(halaqat) {

if (!container) return;


if (!halaqat.length) {

    container.innerHTML = `

        <div class="empty-msg">

            🔍 لا توجد حلقات مطابقة للبحث

        </div>

    `;

    return;

}


/*
 * DocumentFragment يقلل عمليات إعادة
 * الرسم داخل DOM.
 */

const fragment =
    document.createDocumentFragment();


halaqat.forEach(halaqa => {

    const div =
        document.createElement('div');


    div.className =
        'manage-item';


    const hasPhone =
        String(
            halaqa.teacherPhone || ''
        ).trim() !== '';


    div.innerHTML = `

        <div class="item-info">

            <strong class="halaqa-name">

                🏫
                ${escapeHtml(
                    halaqa.name ||
                    'بدون اسم'
                )}

            </strong>


            <div class="halaqa-meta">

                <span class="halaqa-badge teacher">

                    👨‍🏫

                    ${escapeHtml(
                        halaqa.teacherName ||
                        'غير محدد'
                    )}

                </span>


                <span
                    class="halaqa-badge
                    ${hasPhone
                        ? 'phone'
                        : 'no-phone'}"
                >

                    ${hasPhone
                        ? '📞'
                        : '⚠️'}

                    ${hasPhone
                        ? escapeHtml(
                            halaqa.teacherPhone
                        )
                        : 'لا يوجد رقم'}

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


    div
        .querySelector('.edit-btn')
        ?.addEventListener(
            'click',
            () => openEditModal(halaqa)
        );


    div
        .querySelector('.delete-btn')
        ?.addEventListener(
            'click',
            () => deleteHalaqa(halaqa)
        );


    fragment.appendChild(div);

});


container.replaceChildren(
    fragment
);

}

/* =========================================================
تحميل البيانات
========================================================= */

async function init() {

if (!container) return;


try {

    container.innerHTML = `

        <div class="loading">

            جاري تحميل الحلقات...

        </div>

    `;


    /*
     * تحميل مرة واحدة فقط.
     */

    const halaqat =
        await loadHalaqatList();


    if (!Array.isArray(halaqat)) {

        throw new Error(
            'بيانات الحلقات غير صحيحة.'
        );

    }


    allHalaqatCache =
        halaqat.map(
            h => ({ ...h })
        );


    updateStatistics();


    renderHalaqatList(
        allHalaqatCache
    );


} catch (error) {

    console.error(
        'فشل تحميل الحلقات:',
        error
    );


    container.innerHTML = `

        <div class="error-msg">

            ⚠️ فشل تحميل بيانات الحلقات

            <br>

            <small>

                ${escapeHtml(
                    error.message ||
                    'خطأ غير معروف'
                )}

            </small>

        </div>

    `;

}

}

/* =========================================================
البحث الفوري
========================================================= */

searchInput?.addEventListener(
'input',
event => {

    clearTimeout(searchTimer);


    searchTimer =
        setTimeout(
            () => {

                const filtered =
                    filterHalaqat(
                        event.target.value
                    );


                renderHalaqatList(
                    filtered
                );

            },
            70
        );

}

);

/* =========================================================
فتح التعديل
========================================================= */

function openEditModal(halaqa) {

currentHalaqaId =
    halaqa.id;


document.getElementById(
    'editHalaqaId'
).value =
    halaqa.id;


document.getElementById(
    'editHalaqaName'
).value =
    halaqa.name || '';


document.getElementById(
    'editTeacherName'
).value =
    halaqa.teacherName || '';


document.getElementById(
    'editTeacherPhone'
).value =
    halaqa.teacherPhone || '';


modal.style.display =
    'flex';

}

/* =========================================================
حفظ التعديلات
========================================================= */

async function handleSave() {

if (!currentHalaqaId) {
    return;
}


const nameInput =
    document.getElementById(
        'editHalaqaName'
    );

const teacherInput =
    document.getElementById(
        'editTeacherName'
    );

const phoneInput =
    document.getElementById(
        'editTeacherPhone'
    );


const newName =
    nameInput.value.trim();


const newTeacher =
    teacherInput.value.trim();


const newPhone =
    phoneInput.value.trim();


if (!newName || !newTeacher) {

    alert(
        'يرجى إدخال اسم الحلقة واسم الشيخ'
    );

    return;

}


try {

    saveBtn.disabled =
        true;

    saveBtn.innerText =
        'جاري الحفظ...';


    await updateDoc(

        doc(
            db,
            'halaqat',
            currentHalaqaId
        ),

        {

            name:
                newName,

            teacherName:
                newTeacher,

            teacherPhone:
                newPhone

        }

    );


    /*
     * تحديث الكاش مباشرة
     */

    const index =
        allHalaqatCache.findIndex(
            h =>
                h.id ===
                currentHalaqaId
        );


    if (index !== -1) {

        allHalaqatCache[index] = {

            ...allHalaqatCache[index],

            name:
                newName,

            teacherName:
                newTeacher,

            teacherPhone:
                newPhone

        };

    }


    updateStatistics();


    renderHalaqatList(

        filterHalaqat(
            searchInput?.value || ''
        )

    );


    closeModal();


    alert(
        '✅ تم تعديل بيانات الحلقة بنجاح'
    );


} catch (error) {

    console.error(error);


    alert(
        '❌ خطأ في الحفظ: ' +
        error.message
    );


} finally {

    saveBtn.disabled =
        false;

    saveBtn.innerText =
        '💾 حفظ التعديلات';

}

}

saveBtn?.addEventListener(
'click',
handleSave
);

/* =========================================================
حذف الحلقة
========================================================= */

async function deleteHalaqa(halaqa) {

const confirmed =
    confirm(

        `هل أنت متأكد من حذف الحلقة؟

الحلقة: ${halaqa.name}

سيتم حذف بيانات الحلقة فقط.`

    );


if (!confirmed) {
    return;
}


try {

    /*
     * تغيير حالة الزر بصريًا
     */

    const buttons =
        container.querySelectorAll(
            '.delete-btn'
        );


    buttons.forEach(
        button => {
            button.disabled = true;
        }
    );


    await deleteDoc(

        doc(
            db,
            'halaqat',
            halaqa.id
        )

    );


    /*
     * حذف من الذاكرة
     */

    allHalaqatCache =
        allHalaqatCache.filter(
            h =>
                h.id !==
                halaqa.id
        );


    updateStatistics();


    renderHalaqatList(

        filterHalaqat(
            searchInput?.value || ''
        )

    );


    alert(
        '✅ تم حذف الحلقة بنجاح'
    );


} catch (error) {

    console.error(error);


    alert(
        '❌ خطأ في الحذف: ' +
        error.message
    );


    /*
     * إعادة الأزرار
     */

    const buttons =
        container.querySelectorAll(
            '.delete-btn'
        );


    buttons.forEach(
        button => {
            button.disabled = false;
        }
    );

}

}

/* =========================================================
تشغيل الصفحة
========================================================= */

if (
document.readyState ===
'loading'
) {

document.addEventListener(
    'DOMContentLoaded',
    init
);

} else {

init();

}
