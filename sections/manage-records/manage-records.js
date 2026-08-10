// ============================================================
// 📋 إدارة سجلات التسميع والحضور
// ============================================================
// مطابق لصفحة:
// 📖 رصد التسميع والحضور - حلقات القرآن
//
// الحالات:
// ✅ حاضر
// ❌ غائب
// 🔵 إجازة
// 🟠 مستأذن
//
// يدعم:
// 📖 السورة والآيات
// ⭐ حفظ + إتقان + تجويد + مراجعة
// 📅 المطلوب غداً
// 📝 ملاحظات الشيخ
// ⭐ النقاط
// 📖 الأسطر
// ============================================================

import {
    db,
    loadAllRecords
} from '../../../firebase.js';

import {
    doc,
    updateDoc,
    deleteDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ============================================================
// العناصر
// ============================================================

const container =
    document.getElementById(
        'manageRecordsList'
    );

const modal =
    document.getElementById(
        'editRecordModal'
    );

const saveBtn =
    document.getElementById(
        'saveRecordBtn'
    );

const closeModalBtn =
    document.getElementById(
        'closeModalBtn'
    );

const cancelEditBtn =
    document.getElementById(
        'cancelEditBtn'
    );

const statusSelect =
    document.getElementById(
        'editRecordStatus'
    );

const surahFields =
    document.getElementById(
        'recordSurahFields'
    );


// ============================================================
// الحقول
// ============================================================

const studentNameInput =
    document.getElementById(
        'editRecordStudentName'
    );

const halaqaNameInput =
    document.getElementById(
        'editRecordHalaqaName'
    );

const dateInput =
    document.getElementById(
        'editRecordDate'
    );

const surahInput =
    document.getElementById(
        'editRecordSurah'
    );

const fromAyahInput =
    document.getElementById(
        'editRecordFromAyah'
    );

const toAyahInput =
    document.getElementById(
        'editRecordToAyah'
    );

const tomorrowRequirementInput =
    document.getElementById(
        'editRecordTomorrowRequirement'
    );

const notesInput =
    document.getElementById(
        'editRecordNotes'
    );

const pointsInput =
    document.getElementById(
        'editRecordPoints'
    );

const linesInput =
    document.getElementById(
        'editRecordLines'
    );


// ============================================================
// المتغيرات
// ============================================================

let currentRecordId = null;

let currentRecord = null;

let isSaveListenerAttached = false;


// ============================================================
// الحالات
// ============================================================

const ATTENDANCE_STATUS = {

    PRESENT: 'حاضر',

    ABSENT: 'غائب',

    LEAVE: 'إجازة',

    EXCUSED: 'مستأذن'

};


// ============================================================
// إغلاق النافذة
// ============================================================

function closeModal() {

    if (!modal) {
        return;
    }

    modal.style.display =
        'none';

    currentRecordId =
        null;

    currentRecord =
        null;
}


// ============================================================
// أحداث الإغلاق
// ============================================================

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


window.addEventListener(
    'click',
    event => {

        if (
            event.target === modal
        ) {

            closeModal();
        }
    }
);


// ============================================================
// زر ESC لإغلاق النافذة
// ============================================================

window.addEventListener(
    'keydown',
    event => {

        if (
            event.key === 'Escape' &&
            modal &&
            modal.style.display === 'flex'
        ) {

            closeModal();
        }
    }
);


// ============================================================
// تغيير حالة الحضور
// ============================================================

if (statusSelect) {

    statusSelect.addEventListener(
        'change',
        updateStatusFields
    );
}


// ============================================================
// تحديث الحقول حسب الحالة
// ============================================================

function updateStatusFields() {

    if (!statusSelect) {
        return;
    }

    const status =
        statusSelect.value;

    const isPresent =
        status ===
        ATTENDANCE_STATUS.PRESENT;


    // إظهار بيانات التسميع للحاضر فقط

    if (surahFields) {

        surahFields.style.display =
            isPresent
                ? 'block'
                : 'none';
    }


    // إذا لم يكن حاضرًا

    if (!isPresent) {

        clearRecitationFields();

        if (pointsInput) {

            pointsInput.value =
                '0';
        }
    }

}


// ============================================================
// تنظيف بيانات التسميع
// ============================================================

function clearRecitationFields() {

    if (surahInput) {
        surahInput.value = '';
    }

    if (fromAyahInput) {
        fromAyahInput.value = '';
    }

    if (toAyahInput) {
        toAyahInput.value = '';
    }

    if (tomorrowRequirementInput) {
        tomorrowRequirementInput.value = '';
    }

    if (notesInput) {
        notesInput.value = '';
    }


    document
        .querySelectorAll(
            '.eval-check'
        )
        .forEach(
            checkbox => {

                checkbox.checked =
                    false;
            }
        );

}


// ============================================================
// التهيئة
// ============================================================

async function init() {

    if (!container) {
        return;
    }


    try {

        container.innerHTML = `
            <div class="loading">
                ⏳ جاري تحميل السجلات...
            </div>
        `;


        // ====================================================
        // تحميل السجلات
        // ====================================================

        const rawRecords =
            await loadAllRecords();


        if (
            !Array.isArray(
                rawRecords
            )
        ) {

            throw new Error(
                'البيانات القادمة من loadAllRecords ليست مصفوفة.'
            );
        }


        if (
            rawRecords.length === 0
        ) {

            container.innerHTML = `
                <div class="empty-msg">
                    📭 لا توجد سجلات حالياً
                </div>
            `;

            return;
        }


        // ====================================================
        // جلب أسماء الطلاب
        // ====================================================

        const recordsWithNames =
            await Promise.all(

                rawRecords.map(
                    async record => {

                        // إذا كان الاسم محفوظًا داخل السجل

                        if (
                            record.studentName
                        ) {

                            return record;
                        }


                        // محاولة جلب اسم الطالب

                        if (
                            record.studentId
                        ) {

                            try {

                                const studentDoc =
                                    await getDoc(
                                        doc(
                                            db,
                                            'students',
                                            record.studentId
                                        )
                                    );


                                if (
                                    studentDoc.exists()
                                ) {

                                    const studentData =
                                        studentDoc.data();


                                    return {

                                        ...record,

                                        studentName:
                                            studentData.name ||
                                            'طالب بدون اسم'
                                    };
                                }

                            } catch (error) {

                                console.warn(
                                    'تعذر جلب اسم الطالب:',
                                    record.studentId,
                                    error
                                );
                            }
                        }


                        return {

                            ...record,

                            studentName:
                                'طالب غير معروف'
                        };
                    }
                )
            );


        // ====================================================
        // ترتيب السجلات
        // الأحدث أولاً
        // ====================================================

        recordsWithNames.sort(
            sortRecords
        );


        // ====================================================
        // عرض السجلات
        // ====================================================

        renderRecords(
            recordsWithNames
        );


        // ====================================================
        // ربط زر الحفظ مرة واحدة
        // ====================================================

        if (
            saveBtn &&
            !isSaveListenerAttached
        ) {

            saveBtn.addEventListener(
                'click',
                handleSave
            );

            isSaveListenerAttached =
                true;
        }

    } catch (error) {

        console.error(
            'خطأ أثناء تحميل السجلات:',
            error
        );


        container.innerHTML = `

            <div
                class="error-msg"
                style="
                    color:red;
                    padding:20px;
                    text-align:center;
                "
            >

                ❌ حدث خطأ أثناء تحميل السجلات

                <br>

                <small>
                    ${escapeHtml(
                        error.message ||
                        String(error)
                    )}
                </small>

            </div>
        `;
    }

}


// ============================================================
// ترتيب السجلات
// ============================================================

function sortRecords(
    a,
    b
) {

    const dateA =
        String(
            a.date || ''
        );

    const dateB =
        String(
            b.date || ''
        );


    if (
        dateA !== dateB
    ) {

        return dateB.localeCompare(
            dateA
        );
    }


    const timestampA =
        getTimestampValue(
            a.timestamp ||
            a.updatedAt
        );


    const timestampB =
        getTimestampValue(
            b.timestamp ||
            b.updatedAt
        );


    return timestampB -
        timestampA;
}


// ============================================================
// استخراج الوقت
// ============================================================

function getTimestampValue(
    timestamp
) {

    if (!timestamp) {
        return 0;
    }


    try {

        if (
            typeof timestamp.toMillis ===
            'function'
        ) {

            return timestamp.toMillis();
        }


        if (
            typeof timestamp.toDate ===
            'function'
        ) {

            return timestamp.toDate().getTime();
        }


        const date =
            new Date(
                timestamp
            );


        const time =
            date.getTime();


        return Number.isNaN(time)
            ? 0
            : time;

    } catch {

        return 0;
    }
}


// ============================================================
// عرض السجلات
// ============================================================

function renderRecords(
    records
) {

    if (!container) {
        return;
    }


    container.innerHTML = '';


    records.forEach(
        record => {

            const div =
                document.createElement(
                    'div'
                );


            div.className =
                'manage-item';


            const statusInfo =
                getStatusInfo(
                    record.status
                );


            const studentName =
                record.studentName ||
                'طالب غير معروف';


            const halaqaName =
                record.halaqaName ||
                'حلقة غير محددة';


            const date =
                record.date ||
                'بدون تاريخ';


            const grade =
                record.grade ||
                '-';


            const points =
                Number(
                    record.pointsGiven ||
                    0
                );


            const lines =
                Number(
                    record.linesGiven ||
                    0
                );


            let recitationText = '';


            if (
                record.status ===
                ATTENDANCE_STATUS.PRESENT
            ) {

                const surah =
                    record.surah ||
                    'غير محددة';


                const from =
                    record.fromAyah ||
                    '0';


                const to =
                    record.toAyah ||
                    '0';


                recitationText =
                    `
                        📖 ${escapeHtml(
                            surah
                        )}
                        (${escapeHtml(
                            from
                        )} - ${escapeHtml(
                            to
                        )})
                    `;

            } else {

                recitationText =
                    statusInfo.label;
            }


            div.innerHTML = `

                <div class="item-info">

                    <strong>
                        👨‍🎓
                        ${escapeHtml(
                            studentName
                        )}
                    </strong>


                    <small>
                        📖
                        ${escapeHtml(
                            halaqaName
                        )}
                    </small>


                    <small>
                        📅
                        ${escapeHtml(
                            date
                        )}
                    </small>


                    <small
                        class="record-status ${statusInfo.className}"
                    >
                        ${statusInfo.icon}
                        ${statusInfo.label}
                    </small>


                    <small>
                        ${recitationText}
                    </small>


                    <small>
                        ⭐
                        ${escapeHtml(
                            grade
                        )}
                    </small>


                    <small>
                        ⭐ نقاط:
                        ${points}
                    </small>


                    <small>
                        📖 أسطر:
                        ${lines}
                    </small>

                </div>


                <div class="item-actions">

                    <button
                        type="button"
                        class="edit-btn"
                    >
                        ✏️ تعديل
                    </button>


                    <button
                        type="button"
                        class="delete-btn"
                    >
                        🗑️ حذف
                    </button>

                </div>
            `;


            const editBtn =
                div.querySelector(
                    '.edit-btn'
                );


            const deleteBtn =
                div.querySelector(
                    '.delete-btn'
                );


            if (editBtn) {

                editBtn.addEventListener(
                    'click',
                    () =>
                        openEditModal(
                            record
                        )
                );
            }


            if (deleteBtn) {

                deleteBtn.addEventListener(
                    'click',
                    () =>
                        deleteRecord(
                            record
                        )
                );
            }


            container.appendChild(
                div
            );

        }
    );

}


// ============================================================
// معلومات الحالة
// ============================================================

function getStatusInfo(
    status
) {

    switch (status) {

        case ATTENDANCE_STATUS.PRESENT:

            return {

                icon: '✅',

                label: 'حاضر',

                className:
                    'status-present'
            };


        case ATTENDANCE_STATUS.ABSENT:

            return {

                icon: '❌',

                label: 'غائب',

                className:
                    'status-absent'
            };


        case ATTENDANCE_STATUS.LEAVE:

            return {

                icon: '🔵',

                label: 'إجازة',

                className:
                    'status-leave'
            };


        case ATTENDANCE_STATUS.EXCUSED:

            return {

                icon: '🟠',

                label: 'مستأذن',

                className:
                    'status-excused'
            };


        default:

            return {

                icon: '📌',

                label:
                    status ||
                    'غير محدد',

                className:
                    'status-unknown'
            };
    }

}


// ============================================================
// فتح نافذة التعديل
// ============================================================

function openEditModal(
    record
) {

    if (!modal) {
        return;
    }


    currentRecordId =
        record.id;


    currentRecord =
        record;


    // ========================================================
    // البيانات الأساسية
    // ========================================================

    setValue(
        'editRecordId',
        record.id
    );


    if (studentNameInput) {

        studentNameInput.value =
            record.studentName ||
            'طالب غير معروف';
    }


    if (halaqaNameInput) {

        halaqaNameInput.value =
            record.halaqaName ||
            'حلقة غير محددة';
    }


    if (dateInput) {

        dateInput.value =
            record.date ||
            '';
    }


    // ========================================================
    // الحالة
    // ========================================================

    if (statusSelect) {

        const status =
            normalizeStatus(
                record.status
            );


        statusSelect.value =
            status;
    }


    // ========================================================
    // التسميع
    // ========================================================

    if (surahInput) {

        surahInput.value =
            record.status ===
            ATTENDANCE_STATUS.PRESENT

                ? (
                    record.surah || ''
                )

                : '';
    }


    if (fromAyahInput) {

        fromAyahInput.value =
            record.fromAyah ||
            '';
    }


    if (toAyahInput) {

        toAyahInput.value =
            record.toAyah ||
            '';
    }


    // ========================================================
    // المطلوب غداً
    // ========================================================

    if (
        tomorrowRequirementInput
    ) {

        const requirement =
            record.tomorrowRequirement;


        tomorrowRequirementInput.value =
            requirement &&
            requirement !== 'لا يوجد'

                ? requirement

                : '';
    }


    // ========================================================
    // الملاحظات
    // ========================================================

    if (notesInput) {

        notesInput.value =
            record.notes ||
            '';
    }


    // ========================================================
    // النقاط
    // ========================================================

    if (pointsInput) {

        pointsInput.value =
            Number(
                record.pointsGiven ||
                0
            );
    }


    // ========================================================
    // الأسطر
    // ========================================================

    if (linesInput) {

        linesInput.value =
            Number(
                record.linesGiven ||
                0
            );
    }


    // ========================================================
    // التقييم
    // ========================================================

    setEvaluationCheckboxes(
        record.grade
    );


    // ========================================================
    // تحديث الحقول
    // ========================================================

    updateStatusFields();


    // لا نريد أن تصفر النقاط أثناء فتح السجل

    if (pointsInput) {

        pointsInput.value =
            Number(
                record.pointsGiven ||
                0
            );
    }


    modal.style.display =
        'flex';

}


// ============================================================
// تعيين قيمة عنصر
// ============================================================

function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value ?? '';
    }

}


// ============================================================
// تطبيع الحالة
// ============================================================

function normalizeStatus(
    status
) {

    switch (status) {

        case 'حاضر':
            return 'حاضر';

        case 'غائب':
            return 'غائب';

        case 'إجازة':
            return 'إجازة';

        case 'مستأذن':
            return 'مستأذن';

        default:
            return 'حاضر';
    }

}


// ============================================================
// التقييم
// ============================================================

function setEvaluationCheckboxes(
    grade
) {

    const values =
        String(
            grade || ''
        )
        .split(' - ')
        .map(
            value =>
                value.trim()
        )
        .filter(
            Boolean
        );


    document
        .querySelectorAll(
            '.eval-check'
        )
        .forEach(
            checkbox => {

                checkbox.checked =
                    values.includes(
                        checkbox.value
                    );
            }
        );

}


// ============================================================
// استخراج التقييم
// ============================================================

function getGrade(
    status
) {

    if (
        status !==
        ATTENDANCE_STATUS.PRESENT
    ) {

        return '-';
    }


    const evaluations = [];


    document
        .querySelectorAll(
            '.eval-check:checked'
        )
        .forEach(
            checkbox => {

                evaluations.push(
                    checkbox.value
                );
            }
        );


    if (
        evaluations.length > 0
    ) {

        return evaluations.join(
            ' - '
        );
    }


    return 'جيد';

}


// ============================================================
// التحقق من البيانات
// ============================================================

function validateForm() {

    if (!currentRecordId) {

        showMessage(
            '⚠️ لم يتم تحديد السجل.'
        );

        return false;
    }


    const status =
        statusSelect
            ? statusSelect.value
            : 'حاضر';


    // ========================================================
    // التحقق من الحالة
    // ========================================================

    const allowedStatuses =
        Object.values(
            ATTENDANCE_STATUS
        );


    if (
        !allowedStatuses.includes(
            status
        )
    ) {

        showMessage(
            '⚠️ حالة الحضور غير صحيحة.'
        );

        return false;
    }


    // ========================================================
    // التحقق من الحاضر
    // ========================================================

    if (
        status ===
        ATTENDANCE_STATUS.PRESENT
    ) {

        const surah =
            surahInput
                ? surahInput.value.trim()
                : '';


        if (!surah) {

            showMessage(
                '⚠️ يرجى إدخال اسم السورة.'
            );


            if (surahInput) {
                surahInput.focus();
            }


            return false;
        }


        const from =
            Number(
                fromAyahInput?.value ||
                0
            );


        const to =
            Number(
                toAyahInput?.value ||
                0
            );


        if (
            from < 0 ||
            to < 0
        ) {

            showMessage(
                '⚠️ أرقام الآيات لا يمكن أن تكون سالبة.'
            );

            return false;
        }


        if (
            from > 0 &&
            to > 0 &&
            from > to
        ) {

            showMessage(
                '⚠️ آية البداية يجب أن تكون قبل آية النهاية.'
            );

            return false;
        }

    }


    // ========================================================
    // النقاط
    // ========================================================

    const points =
        Number(
            pointsInput?.value ||
            0
        );


    if (
        !Number.isFinite(
            points
        ) ||
        points < 0
    ) {

        showMessage(
            '⚠️ يرجى إدخال عدد نقاط صحيح.'
        );

        if (pointsInput) {
            pointsInput.focus();
        }

        return false;
    }


    // ========================================================
    // الأسطر
    // ========================================================

    const lines =
        Number(
            linesInput?.value ||
            0
        );


    if (
        !Number.isFinite(
            lines
        ) ||
        lines < 0
    ) {

        showMessage(
            '⚠️ يرجى إدخال عدد أسطر صحيح.'
        );

        if (linesInput) {
            linesInput.focus();
        }

        return false;
    }


    return true;

}


// ============================================================
// تجهيز بيانات السجل
// ============================================================

function buildUpdatedRecordData() {

    const status =
        statusSelect
            ? statusSelect.value
            : ATTENDANCE_STATUS.PRESENT;


    let surah =
        surahInput
            ? surahInput.value.trim()
            : '';


    let fromAyah =
        fromAyahInput
            ? fromAyahInput.value.trim()
            : '';


    let toAyah =
        toAyahInput
            ? toAyahInput.value.trim()
            : '';


    let tomorrowRequirement =
        tomorrowRequirementInput
            ? tomorrowRequirementInput.value.trim()
            : '';


    let notes =
        notesInput
            ? notesInput.value.trim()
            : '';


    let points =
        Number(
            pointsInput?.value ||
            0
        );


    let lines =
        Number(
            linesInput?.value ||
            0
        );


    // ========================================================
    // الحالات غير الحاضرة
    // ========================================================

    if (
        status !==
        ATTENDANCE_STATUS.PRESENT
    ) {

        surah =
            status;

        fromAyah =
            '0';

        toAyah =
            '0';

        tomorrowRequirement =
            'لا يوجد';

        points =
            0;

        lines =
            0;

        notes =
            notes || '';
    }


    // ========================================================
    // الحاضر
    // ========================================================

    if (
        status ===
        ATTENDANCE_STATUS.PRESENT
    ) {

        fromAyah =
            fromAyah ||
            '0';


        toAyah =
            toAyah ||
            '0';


        tomorrowRequirement =
            tomorrowRequirement ||
            'لا يوجد';
    }


    const grade =
        getGrade(
            status
        );


    return {

        status,

        surah,

        fromAyah,

        toAyah,

        grade,

        tomorrowRequirement,

        notes,

        pointsGiven:
            points,

        linesGiven:
            lines,

        updatedAt:
            new Date()
    };

}


// ============================================================
// حفظ التعديل
// ============================================================

async function handleSave() {

    if (!currentRecordId) {

        showMessage(
            '⚠️ لم يتم تحديد السجل.'
        );

        return;
    }


    if (
        saveBtn &&
        saveBtn.disabled
    ) {

        return;
    }


    if (!validateForm()) {
        return;
    }


    const updatedData =
        buildUpdatedRecordData();


    const oldPoints =
        Number(
            currentRecord?.pointsGiven ||
            0
        );


    const newPoints =
        Number(
            updatedData.pointsGiven ||
            0
        );


    const pointsDifference =
        newPoints -
        oldPoints;


    if (saveBtn) {

        saveBtn.disabled =
            true;

        saveBtn.dataset.originalText =
            saveBtn.innerHTML;

        saveBtn.innerHTML = `
            ⏳ جاري الحفظ...
        `;
    }


    try {

        // ====================================================
        // تحديث السجل
        // ====================================================

        await updateDoc(

            doc(
                db,
                'records',
                currentRecordId
            ),

            updatedData
        );


        // ====================================================
        // تحديث مجموع نقاط الطالب
        // ====================================================

        if (
            pointsDifference !== 0 &&
            currentRecord?.studentId
        ) {

            await updateDoc(

                doc(
                    db,
                    'students',
                    currentRecord.studentId
                ),

                {
                    totalPoints:
                        incrementValue(
                            pointsDifference
                        )
                }
            );
        }


        // ====================================================
        // رسالة النجاح
        // ====================================================

        const statusInfo =
            getStatusInfo(
                updatedData.status
            );


        showMessage(

            `✅ تم تعديل السجل بنجاح\n\n` +

            `👤 الطالب: ${
                currentRecord?.studentName ||
                'غير معروف'
            }\n` +

            `📌 الحالة: ${
                statusInfo.icon
            } ${
                updatedData.status
            }\n` +

            `⭐ النقاط: ${
                newPoints
            }\n` +

            `📊 التقييم: ${
                updatedData.grade
            }`

        );


        closeModal();


        // إعادة تحميل القائمة

        await init();


    } catch (error) {

        console.error(
            'Save Record Error:',
            error
        );


        showMessage(

            '❌ حدث خطأ أثناء حفظ التعديلات.\n\n' +
            (
                error.message ||
                error
            )

        );

    } finally {

        if (saveBtn) {

            saveBtn.disabled =
                false;

            saveBtn.innerHTML =
                saveBtn.dataset.originalText ||
                '💾 حفظ التعديلات';
        }
    }

}


// ============================================================
// increment
// ============================================================
// نستخدم increment من Firestore بشكل ديناميكي لتجنب الحاجة
// إلى إعادة تحميل الصفحة.
// ============================================================

import {
    increment as firestoreIncrement
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


function incrementValue(
    value
) {

    return firestoreIncrement(
        value
    );
}


// ============================================================
// حذف السجل
// ============================================================

async function deleteRecord(
    record
) {

    if (!record?.id) {

        showMessage(
            '❌ معرف السجل غير موجود.'
        );

        return;
    }


    const studentName =
        record.studentName ||
        'الطالب';


    const statusInfo =
        getStatusInfo(
            record.status
        );


    const confirmed =
        confirm(

            `⚠️ هل أنت متأكد من حذف هذا السجل؟\n\n` +

            `👤 الطالب: ${studentName}\n` +

            `📅 التاريخ: ${
                record.date ||
                'غير محدد'
            }\n` +

            `📌 الحالة: ${
                statusInfo.label
            }\n\n` +

            `سيتم خصم نقاط هذا السجل من مجموع نقاط الطالب إذا كانت موجودة.`

        );


    if (!confirmed) {
        return;
    }


    try {

        const pointsToRemove =
            Number(
                record.pointsGiven ||
                0
            );


        // ====================================================
        // حذف السجل
        // ====================================================

        await deleteDoc(

            doc(
                db,
                'records',
                record.id
            )
        );


        // ====================================================
        // خصم نقاط السجل
        // ====================================================

        if (
            pointsToRemove !== 0 &&
            record.studentId
        ) {

            try {

                await updateDoc(

                    doc(
                        db,
                        'students',
                        record.studentId
                    ),

                    {
                        totalPoints:
                            incrementValue(
                                -pointsToRemove
                            )
                    }
                );

            } catch (pointsError) {

                console.error(
                    'Points Update Error:',
                    pointsError
                );


                showMessage(

                    '⚠️ تم حذف السجل، لكن تعذر تحديث مجموع نقاط الطالب.\n\n' +
                    pointsError.message

                );

                await init();

                return;
            }
        }


        showMessage(
            '✅ تم حذف السجل وتحديث نقاط الطالب بنجاح.'
        );


        await init();

    } catch (error) {

        console.error(
            'Delete Record Error:',
            error
        );


        showMessage(

            '❌ حدث خطأ أثناء حذف السجل.\n\n' +
            (
                error.message ||
                error
            )

        );
    }

}


// ============================================================
// حماية HTML
// ============================================================

function escapeHtml(
    value
) {

    return String(
        value ?? ''
    )

        .replace(
            /&/g,
            '&amp;'
        )

        .replace(
            /</g,
            '&lt;'
        )

        .replace(
            />/g,
            '&gt;'
        )

        .replace(
            /"/g,
            '&quot;'
        )

        .replace(
            /'/g,
            '&#039;'
        );

}


// ============================================================
// رسالة
// ============================================================

function showMessage(
    message
) {

    alert(
        message
    );

}


// ============================================================
// تشغيل الصفحة
// ============================================================

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
