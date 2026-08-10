import {
    db,
    loadAllRecords,
    loadAllStudents
} from '../../../firebase.js';

import {
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================================================
   عناصر الصفحة
   ========================================================= */

const container =
    document.getElementById('manageRecordsList');

const modal =
    document.getElementById('editRecordModal');

const saveBtn =
    document.getElementById('saveRecordBtn');

const closeModalBtn =
    document.getElementById('closeModalBtn');

const cancelEditBtn =
    document.getElementById('cancelEditBtn');

const statusSelect =
    document.getElementById('editRecordStatus');

const surahFields =
    document.getElementById('recordSurahFields');

const searchInput =
    document.getElementById('recordSearchInput');

const statusFilter =
    document.getElementById('recordStatusFilter');

/* الإحصائيات */

const totalRecordsCount =
    document.getElementById('totalRecordsCount');

const presentRecordsCount =
    document.getElementById('presentRecordsCount');

const absentRecordsCount =
    document.getElementById('absentRecordsCount');

const leaveRecordsCount =
    document.getElementById('leaveRecordsCount');

/* =========================================================
   البيانات المحلية
   ========================================================= */

let allRecordsCache = [];
let currentRecordId = null;

/* =========================================================
   أدوات مساعدة
   ========================================================= */

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* =========================================================
   المودال
   ========================================================= */

function closeModal() {

    if (modal) {
        modal.style.display = 'none';
    }

    currentRecordId = null;
}

if (closeModalBtn) {
    closeModalBtn.addEventListener(
        'click',
        closeModal
    );
}

if (cancelEditBtn) {
    cancelEditBtn.addEventListener(
        'click',
        closeModal
    );
}

window.addEventListener('click', event => {

    if (event.target === modal) {
        closeModal();
    }

});

/* إظهار/إخفاء بيانات السورة */

if (statusSelect && surahFields) {

    statusSelect.addEventListener(
        'change',
        () => {

            surahFields.style.display =
                statusSelect.value === 'حاضر'
                    ? 'block'
                    : 'none';

        }
    );

}

/* =========================================================
   Skeleton
   ========================================================= */

function showSkeleton() {

    if (!container) return;

    container.innerHTML = `
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
    `;
}

/* =========================================================
   تحديث الإحصائيات
   ========================================================= */

function updateStatistics(records) {

    let present = 0;
    let absent = 0;
    let leave = 0;

    records.forEach(record => {

        switch (record.status) {

            case 'حاضر':
                present++;
                break;

            case 'غائب':
                absent++;
                break;

            case 'إجازة':
                leave++;
                break;

        }

    });

    if (totalRecordsCount) {
        totalRecordsCount.textContent =
            records.length.toLocaleString('ar');
    }

    if (presentRecordsCount) {
        presentRecordsCount.textContent =
            present.toLocaleString('ar');
    }

    if (absentRecordsCount) {
        absentRecordsCount.textContent =
            absent.toLocaleString('ar');
    }

    if (leaveRecordsCount) {
        leaveRecordsCount.textContent =
            leave.toLocaleString('ar');
    }
}

/* =========================================================
   تحميل البيانات
   ========================================================= */

async function init() {

    if (!container) return;

    try {

        showSkeleton();

        /*
         * نجلب السجلات والطلاب بالتوازي.
         *
         * هذا أفضل من:
         *
         * await loadAllRecords()
         * ثم await loadAllStudents()
         *
         */

        const [
            rawRecords,
            students
        ] = await Promise.all([

            loadAllRecords(),

            loadAllStudents().catch(error => {

                console.warn(
                    'تعذر تحميل الطلاب:',
                    error
                );

                return [];
            })

        ]);

        if (!Array.isArray(rawRecords)) {

            throw new Error(
                'البيانات القادمة من loadAllRecords ليست مصفوفة.'
            );

        }

        /*
         * إنشاء Map للطلاب.
         *
         * البحث داخل Map سريع جدًا
         * مقارنة بجلب Firestore لكل سجل.
         */

        const studentsMap = new Map();

        if (Array.isArray(students)) {

            students.forEach(student => {

                if (student.id) {

                    studentsMap.set(
                        student.id,
                        student.name || 'طالب بدون اسم'
                    );

                }

            });

        }

        /*
         * ربط أسماء الطلاب بالسجلات
         */

        allRecordsCache =
            rawRecords.map(record => {

                const studentName =
                    record.studentName ||
                    studentsMap.get(record.studentId) ||
                    'طالب غير معروف';

                return {
                    ...record,
                    studentName
                };

            });

        /*
         * تحديث الإحصائيات
         */

        updateStatistics(allRecordsCache);

        /*
         * عرض القائمة
         */

        renderRecords();

    } catch (error) {

        console.error(
            'خطأ أثناء تحميل السجلات:',
            error
        );

        container.innerHTML = `
            <div class="error-msg">

                ❌ حدث خطأ أثناء تحميل السجلات

                <br>

                <small>
                    ${escapeHtml(
                        error.message || error
                    )}
                </small>

            </div>
        `;

    }

}

/* =========================================================
   البحث والفلترة
   ========================================================= */

function getFilteredRecords() {

    const search =
        (searchInput?.value || '')
            .trim()
            .toLowerCase();

    const status =
        statusFilter?.value || '';

    return allRecordsCache.filter(record => {

        const matchesSearch =
            !search ||
            String(record.studentName || '')
                .toLowerCase()
                .includes(search);

        const matchesStatus =
            !status ||
            record.status === status;

        return matchesSearch && matchesStatus;

    });

}

/* =========================================================
   عرض السجلات
   ========================================================= */

function renderRecords() {

    if (!container) return;

    const records =
        getFilteredRecords();

    if (records.length === 0) {

        container.innerHTML = `
            <div class="empty-msg">
                🔎 لا توجد سجلات مطابقة
            </div>
        `;

        return;
    }

    /*
     * DocumentFragment يقلل عمليات تحديث DOM.
     */

    const fragment =
        document.createDocumentFragment();

    records.forEach(record => {

        const div =
            document.createElement('div');

        div.className =
            'manage-item';

        let statusClass =
            'status-present';

        if (record.status === 'غائب') {
            statusClass =
                'status-absent';
        }

        if (record.status === 'إجازة') {
            statusClass =
                'status-leave';
        }

        let details = '';

        if (record.status === 'حاضر') {

            details = `
                <small>
                    📖 ${escapeHtml(
                        record.surah || 'غير محددة'
                    )}
                    ${
                        record.fromAyah ||
                        record.toAyah
                            ? `(${escapeHtml(
                                record.fromAyah || '0'
                              )}-${escapeHtml(
                                record.toAyah || '0'
                              )})`
                            : ''
                    }
                </small>
            `;

        } else {

            details = `
                <small class="status-badge ${statusClass}">
                    ${
                        record.status === 'غائب'
                            ? '❌ غائب'
                            : '🔵 إجازة'
                    }
                </small>
            `;

        }

        div.innerHTML = `

            <div class="item-info">

                <strong>
                    👨‍🎓
                    ${escapeHtml(
                        record.studentName
                    )}
                </strong>

                <div class="item-meta">

                    <small>
                        📅
                        ${escapeHtml(
                            record.date || 'بدون تاريخ'
                        )}
                    </small>

                    ${details}

                    <small>
                        ⭐
                        ${escapeHtml(
                            record.grade || '-'
                        )}
                    </small>

                    <small>
                        📊 نقاط:
                        ${Number(
                            record.pointsGiven || 0
                        )}
                    </small>

                    <small>
                        📖 أسطر:
                        ${Number(
                            record.linesGiven || 0
                        )}
                    </small>

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

        const editBtn =
            div.querySelector('.edit-btn');

        const deleteBtn =
            div.querySelector('.delete-btn');

        if (editBtn) {

            editBtn.addEventListener(
                'click',
                () => openEditModal(record)
            );

        }

        if (deleteBtn) {

            deleteBtn.addEventListener(
                'click',
                () => deleteRecord(record.id)
            );

        }

        fragment.appendChild(div);

    });

    container.innerHTML = '';

    container.appendChild(fragment);
}

/* =========================================================
   البحث
   ========================================================= */

if (searchInput) {

    searchInput.addEventListener(
        'input',
        renderRecords
    );

}

/* =========================================================
   الفلترة
   ========================================================= */

if (statusFilter) {

    statusFilter.addEventListener(
        'change',
        renderRecords
    );

}

/* =========================================================
   فتح التعديل
   ========================================================= */

function openEditModal(record) {

    if (!modal) return;

    currentRecordId =
        record.id;

    const setValue =
        (id, value) => {

            const element =
                document.getElementById(id);

            if (element) {
                element.value =
                    value ?? '';
            }

        };

    setValue(
        'editRecordId',
        record.id
    );

    setValue(
        'editRecordStudentName',
        record.studentName || 'طالب غير معروف'
    );

    setValue(
        'editRecordDate',
        record.date || ''
    );

    setValue(
        'editRecordSurah',
        record.surah || ''
    );

    setValue(
        'editRecordFromAyah',
        record.fromAyah || ''
    );

    setValue(
        'editRecordToAyah',
        record.toAyah || ''
    );

    setValue(
        'editRecordPoints',
        record.pointsGiven || 0
    );

    setValue(
        'editRecordLines',
        record.linesGiven || 0
    );

    if (statusSelect) {

        statusSelect.value =
            record.status || 'حاضر';

    }

    if (surahFields) {

        surahFields.style.display =
            record.status === 'حاضر'
                ? 'block'
                : 'none';

    }

    modal.style.display = 'flex';
}

/* =========================================================
   حفظ التعديل
   ========================================================= */

async function handleSave() {

    if (!currentRecordId) {
        return;
    }

    const status =
        statusSelect?.value || 'حاضر';

    const surah =
        document
            .getElementById('editRecordSurah')
            ?.value
            .trim() || '';

    const fromAyah =
        document
            .getElementById('editRecordFromAyah')
            ?.value
            .trim() || '0';

    const toAyah =
        document
            .getElementById('editRecordToAyah')
            ?.value
            .trim() || '0';

    const points =
        parseInt(
            document
                .getElementById('editRecordPoints')
                ?.value
        ) || 0;

    const lines =
        parseInt(
            document
                .getElementById('editRecordLines')
                ?.value
        ) || 0;

    try {

        saveBtn.disabled = true;
        saveBtn.textContent =
            'جاري الحفظ...';

        await updateDoc(
            doc(
                db,
                'records',
                currentRecordId
            ),
            {
                status,

                surah:
                    status === 'حاضر'
                        ? surah
                        : status,

                fromAyah,
                toAyah,

                pointsGiven: points,
                linesGiven: lines
            }
        );

        /*
         * تحديث الكاش مباشرة
         * بدون إعادة تحميل Firestore.
         */

        const index =
            allRecordsCache.findIndex(
                record =>
                    record.id === currentRecordId
            );

        if (index !== -1) {

            allRecordsCache[index] = {

                ...allRecordsCache[index],

                status,

                surah:
                    status === 'حاضر'
                        ? surah
                        : status,

                fromAyah,
                toAyah,

                pointsGiven: points,
                linesGiven: lines
            };

        }

        updateStatistics(
            allRecordsCache
        );

        renderRecords();

        closeModal();

        alert(
            '✅ تم تحديث السجل بنجاح'
        );

    } catch (error) {

        console.error(error);

        alert(
            '❌ خطأ أثناء الحفظ: ' +
            error.message
        );

    } finally {

        if (saveBtn) {

            saveBtn.disabled = false;

            saveBtn.textContent =
                '💾 حفظ التعديلات';

        }

    }
}

/* =========================================================
   ربط الحفظ
   ========================================================= */

if (saveBtn) {

    saveBtn.addEventListener(
        'click',
        handleSave
    );

}

/* =========================================================
   حذف السجل
   ========================================================= */

async function deleteRecord(id) {

    const record =
        allRecordsCache.find(
            item => item.id === id
        );

    if (!record) return;

    const confirmed =
        confirm(
            `هل أنت متأكد من حذف سجل الطالب (${record.studentName})؟`
        );

    if (!confirmed) return;

    try {

        await deleteDoc(
            doc(
                db,
                'records',
                id
            )
        );

        /*
         * حذف من الذاكرة مباشرة
         */

        allRecordsCache =
            allRecordsCache.filter(
                item => item.id !== id
            );

        updateStatistics(
            allRecordsCache
        );

        renderRecords();

        alert(
            '✅ تم حذف السجل بنجاح'
        );

    } catch (error) {

        console.error(error);

        alert(
            '❌ خطأ أثناء الحذف: ' +
            error.message
        );

    }
}

/* =========================================================
   التشغيل
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
