// ============================================================
// 📋 إدارة سجلات التسميع والحضور
// ============================================================
//
// ✅ الإحصائيات:
//    - إجمالي السجلات
//    - إجمالي الحضور
//    - إجمالي الغياب
//    - إجمالي الإجازات
//    - إجمالي المستأذنين
//
// ✅ الفلترة:
//    - حسب الحالة
//    - حسب الحلقة
//    - حسب اسم الطالب
//
// ✅ الضغط على الإحصائية يطبق الفلتر مباشرة
//
// ✅ تعديل السجل
// ✅ حذف السجل
// ✅ تحديث نقاط الطالب
// ============================================================


import {
    db,
    loadAllRecords
} from '../../../firebase.js';


import {
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    increment
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
// حقول التعديل
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
// عناصر الإحصائيات
// ============================================================

const totalRecordsCount =
    document.getElementById(
        'totalRecordsCount'
    );

const presentCount =
    document.getElementById(
        'presentCount'
    );

const absentCount =
    document.getElementById(
        'absentCount'
    );

const leaveCount =
    document.getElementById(
        'leaveCount'
    );

const excusedCount =
    document.getElementById(
        'excusedCount'
    );


// ============================================================
// عناصر الفلترة
// ============================================================

const statusFilter =
    document.getElementById(
        'statusFilter'
    );

const halaqaFilter =
    document.getElementById(
        'halaqaFilter'
    );

const studentSearch =
    document.getElementById(
        'studentSearch'
    );

const resetFiltersBtn =
    document.getElementById(
        'resetFiltersBtn'
    );

const filterResultInfo =
    document.getElementById(
        'filterResultInfo'
    );

const activeFilterBadge =
    document.getElementById(
        'activeFilterBadge'
    );


// ============================================================
// المتغيرات
// ============================================================

let allRecords = [];

let filteredRecords = [];

let currentRecordId = null;

let currentRecord = null;

let isSaveListenerAttached = false;


// ============================================================
// الحالات
// ============================================================

const ATTENDANCE_STATUS = {

    PRESENT:
        'حاضر',

    ABSENT:
        'غائب',

    LEAVE:
        'إجازة',

    EXCUSED:
        'مستأذن'

};


// ============================================================
// تشغيل الصفحة
// ============================================================

async function init() {

    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="loading">

            <div class="loading-spinner"></div>

            <span>
                ⏳ جاري تحميل السجلات...
            </span>

        </div>

    `;


    try {

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


        // ====================================================
        // جلب أسماء الطلاب الناقصة
        // ====================================================

        allRecords =
            await enrichRecords(
                rawRecords
            );


        // ====================================================
        // ترتيب السجلات
        // ====================================================

        allRecords.sort(
            sortRecords
        );


        // ====================================================
        // الإحصائيات
        // ====================================================

        updateStatistics(
            allRecords
        );


        // ====================================================
        // الحلقات
        // ====================================================

        populateHalaqaFilter(
            allRecords
        );


        // ====================================================
        // الفلترة
        // ====================================================

        applyFilters();


        // ====================================================
        // زر الحفظ
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
            'Load Records Error:',
            error
        );


        container.innerHTML = `

            <div class="error-msg">

                ❌ حدث خطأ أثناء تحميل السجلات

                <br><br>

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
// إثراء السجلات بأسماء الطلاب
// ============================================================

async function enrichRecords(
    records
) {

    return Promise.all(

        records.map(
            async record => {

                if (
                    record.studentName
                ) {

                    return record;
                }


                if (
                    !record.studentId
                ) {

                    return {

                        ...record,

                        studentName:
                            'طالب غير معروف'
                    };
                }


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
                        'تعذر جلب الطالب:',
                        record.studentId,
                        error
                    );
                }


                return {

                    ...record,

                    studentName:
                        'طالب غير معروف'
                };

            }
        )
    );

}


// ============================================================
// الإحصائيات
// ============================================================

function updateStatistics(
    records
) {

    let present = 0;

    let absent = 0;

    let leave = 0;

    let excused = 0;


    records.forEach(
        record => {

            switch (
                normalizeStatus(
                    record.status
                )
            ) {

                case ATTENDANCE_STATUS.PRESENT:

                    present++;
                    break;


                case ATTENDANCE_STATUS.ABSENT:

                    absent++;
                    break;


                case ATTENDANCE_STATUS.LEAVE:

                    leave++;
                    break;


                case ATTENDANCE_STATUS.EXCUSED:

                    excused++;
                    break;
            }

        }
    );


    if (totalRecordsCount) {

        totalRecordsCount.textContent =
            records.length;
    }


    if (presentCount) {

        presentCount.textContent =
            present;
    }


    if (absentCount) {

        absentCount.textContent =
            absent;
    }


    if (leaveCount) {

        leaveCount.textContent =
            leave;
    }


    if (excusedCount) {

        excusedCount.textContent =
            excused;
    }

}


// ============================================================
// تعبئة فلتر الحلقات
// ============================================================

function populateHalaqaFilter(
    records
) {

    if (!halaqaFilter) {
        return;
    }


    const halaqatMap =
        new Map();


    records.forEach(
        record => {

            const id =
                record.halaqaId ||
                '';


            const name =
                record.halaqaName ||
                'حلقة غير محددة';


            if (id) {

                halaqatMap.set(
                    id,
                    name
                );
            }

        }
    );


    halaqaFilter.innerHTML = `

        <option value="">
            جميع الحلقات
        </option>

    `;


    const halaqat =
        Array.from(
            halaqatMap.entries()
        );


    halaqat.sort(
        (a, b) =>
            String(a[1])
                .localeCompare(
                    String(b[1]),
                    'ar'
                )
    );


    halaqat.forEach(
        ([id, name]) => {

            const option =
                document.createElement(
                    'option'
                );


            option.value =
                id;


            option.textContent =
                name;


            halaqaFilter.appendChild(
                option
            );

        }
    );

}


// ============================================================
// تطبيق الفلاتر
// ============================================================

function applyFilters() {

    const selectedStatus =
        statusFilter
            ? statusFilter.value
            : '';


    const selectedHalaqa =
        halaqaFilter
            ? halaqaFilter.value
            : '';


    const searchText =
        studentSearch
            ? studentSearch.value
                .trim()
                .toLowerCase()
            : '';


    filteredRecords =
        allRecords.filter(
            record => {

                // الحالة

                if (
                    selectedStatus &&
                    normalizeStatus(
                        record.status
                    ) !== selectedStatus
                ) {

                    return false;
                }


                // الحلقة

                if (
                    selectedHalaqa &&
                    String(
                        record.halaqaId ||
                        ''
                    ) !== selectedHalaqa
                ) {

                    return false;
                }


                // اسم الطالب

                if (
                    searchText
                ) {

                    const name =
                        String(
                            record.studentName ||
                            ''
                        )
                        .toLowerCase();


                    if (
                        !name.includes(
                            searchText
                        )
                    ) {

                        return false;
                    }
                }


                return true;
            }
        );


    renderRecords(
        filteredRecords
    );


    updateFilterInfo(
        filteredRecords.length
    );

}


// ============================================================
// معلومات الفلترة
// ============================================================

function updateFilterInfo(
    count
) {

    const status =
        statusFilter
            ? statusFilter.value
            : '';


    const halaqa =
        halaqaFilter
            ? halaqaFilter.value
            : '';


    const search =
        studentSearch
            ? studentSearch.value.trim()
            : '';


    const filters = [];


    if (status) {

        const info =
            getStatusInfo(
                status
            );

        filters.push(
            `${info.icon} ${info.label}`
        );
    }


    if (halaqa) {

        const selectedOption =
            halaqaFilter.options[
                halaqaFilter.selectedIndex
            ];


        if (selectedOption) {

            filters.push(
                `📖 ${selectedOption.textContent}`
            );
        }
    }


    if (search) {

        filters.push(
            `👨‍🎓 "${search}"`
        );
    }


    if (filters.length === 0) {

        if (filterResultInfo) {

            filterResultInfo.innerHTML = `

                📊 عرض جميع السجلات

                <strong>
                    (${count})
                </strong>

            `;
        }


        if (activeFilterBadge) {

            activeFilterBadge.textContent =
                '📊 الكل';
        }

    } else {

        if (filterResultInfo) {

            filterResultInfo.innerHTML = `

                🔎 نتائج الفلترة:

                <strong>
                    ${count}
                </strong>

                <span>
                    ${filters.join(' • ')}
                </span>

            `;
        }


        if (activeFilterBadge) {

            activeFilterBadge.textContent =
                filters[0];
        }

    }

}


// ============================================================
// الأحداث الخاصة بالفلاتر
// ============================================================

if (statusFilter) {

    statusFilter.addEventListener(
        'change',
        applyFilters
    );
}


if (halaqaFilter) {

    halaqaFilter.addEventListener(
        'change',
        applyFilters
    );
}


if (studentSearch) {

    studentSearch.addEventListener(
        'input',
        applyFilters
    );
}


// ============================================================
// الإحصائيات قابلة للنقر
// ============================================================

document
    .querySelectorAll(
        '.stat-card'
    )
    .forEach(
        card => {

            card.addEventListener(
                'click',
                () => {

                    const filter =
                        card.dataset.filter ||
                        '';


                    if (statusFilter) {

                        statusFilter.value =
                            filter;
                    }


                    document
                        .querySelectorAll(
                            '.stat-card'
                        )
                        .forEach(
                            item => {

                                item.classList.remove(
                                    'active'
                                );

                            }
                        );


                    card.classList.add(
                        'active'
                    );


                    applyFilters();

                }
            );

        }
    );


// ============================================================
// إعادة ضبط
// ============================================================

if (resetFiltersBtn) {

    resetFiltersBtn.addEventListener(
        'click',
        () => {

            if (statusFilter) {

                statusFilter.value =
                    '';
            }


            if (halaqaFilter) {

                halaqaFilter.value =
                    '';
            }


            if (studentSearch) {

                studentSearch.value =
                    '';
            }


            document
                .querySelectorAll(
                    '.stat-card'
                )
                .forEach(
                    card => {

                        card.classList.remove(
                            'active'
                        );

                    }
                );


            const allCard =
                document.querySelector(
                    '.stat-card[data-filter=""]'
                );


            if (allCard) {

                allCard.classList.add(
                    'active'
                );
            }


            applyFilters();

        }
    );

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
// استخراج timestamp
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

            return timestamp
                .toDate()
                .getTime();
        }


        const value =
            new Date(
                timestamp
            ).getTime();


        return Number.isNaN(value)
            ? 0
            : value;

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


    if (
        !records ||
        records.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-msg">

                <div class="empty-icon">
                    📭
                </div>

                <strong>
                    لا توجد سجلات
                </strong>

                <span>
                    لا توجد سجلات مطابقة للفلاتر الحالية.
                </span>

            </div>

        `;

        return;
    }


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


            let recitationText =
                '';


            if (
                normalizeStatus(
                    record.status
                ) ===
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


                recitationText = `

                    📖 ${escapeHtml(
                        surah
                    )}

                    <span class="ayah-range">
                        (${escapeHtml(
                            from
                        )} - ${escapeHtml(
                            to
                        )})
                    </span>

                `;

            } else {

                recitationText =
                    statusInfo.label;
            }


            div.innerHTML = `

                <div class="item-info">


                    <div class="student-title">

                        <strong>
                            👨‍🎓
                            ${escapeHtml(
                                studentName
                            )}
                        </strong>

                    </div>


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


                    <small class="recitation-info">

                        ${recitationText}

                    </small>


                    <small>
                        ⭐ التقييم:
                        ${escapeHtml(
                            grade
                        )}
                    </small>


                    <small>
                        ⭐ النقاط:
                        ${points}
                    </small>


                    <small>
                        📖 الأسطر:
                        ${lines}
                    </small>


                    ${
                        record.notes
                            ? `
                                <small>
                                    📝
                                    ${escapeHtml(
                                        record.notes
                                    )}
                                </small>
                            `
                            : ''
                    }


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

    switch (
        normalizeStatus(status)
    ) {

        case ATTENDANCE_STATUS.PRESENT:

            return {

                icon:
                    '✅',

                label:
                    'حاضر',

                className:
                    'status-present'
            };


        case ATTENDANCE_STATUS.ABSENT:

            return {

                icon:
                    '❌',

                label:
                    'غائب',

                className:
                    'status-absent'
            };


        case ATTENDANCE_STATUS.LEAVE:

            return {

                icon:
                    '🔵',

                label:
                    'إجازة',

                className:
                    'status-leave'
            };


        case ATTENDANCE_STATUS.EXCUSED:

            return {

                icon:
                    '🟠',

                label:
                    'مستأذن',

                className:
                    'status-excused'
            };


        default:

            return {

                icon:
                    '📌',

                label:
                    status ||
                    'غير محدد',

                className:
                    'status-unknown'
            };

    }

}


// ============================================================
// تطبيع الحالة
// ============================================================

function normalizeStatus(
    status
) {

    const value =
        String(
            status || ''
        ).trim();


    switch (value) {

        case 'حاضر':
            return 'حاضر';

        case 'غائب':
            return 'غائب';

        case 'إجازة':
            return 'إجازة';

        case 'مستأذن':
            return 'مستأذن';

        default:
            return value;

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


    if (statusSelect) {

        statusSelect.value =
            normalizeStatus(
                record.status
            );
    }


    if (surahInput) {

        surahInput.value =
            record.status ===
            ATTENDANCE_STATUS.PRESENT

                ? (
                    record.surah ||
                    ''
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


    if (tomorrowRequirementInput) {

        const requirement =
            record.tomorrowRequirement;


        tomorrowRequirementInput.value =
            requirement &&
            requirement !== 'لا يوجد'

                ? requirement

                : '';
    }


    if (notesInput) {

        notesInput.value =
            record.notes ||
            '';
    }


    if (pointsInput) {

        pointsInput.value =
            Number(
                record.pointsGiven ||
                0
            );
    }


    if (linesInput) {

        linesInput.value =
            Number(
                record.linesGiven ||
                0
            );
    }


    setEvaluationCheckboxes(
        record.grade
    );


    updateStatusFields();


    // إعادة النقاط بعد updateStatusFields

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
// تغيير الحالة داخل التعديل
// ============================================================

if (statusSelect) {

    statusSelect.addEventListener(
        'change',
        updateStatusFields
    );

}


function updateStatusFields() {

    if (!statusSelect) {
        return;
    }


    const status =
        statusSelect.value;


    const isPresent =
        status ===
        ATTENDANCE_STATUS.PRESENT;


    if (surahFields) {

        surahFields.style.display =
            isPresent
                ? 'block'
                : 'none';
    }


    if (!isPresent) {

        clearRecitationFields();


        if (pointsInput) {

            pointsInput.value =
                '0';
        }


        if (linesInput) {

            linesInput.value =
                '0';
        }

    }

}


// ============================================================
// تنظيف بيانات التسميع
// ============================================================

function clearRecitationFields() {

    if (surahInput) {

        surahInput.value =
            '';
    }


    if (fromAyahInput) {

        fromAyahInput.value =
            '';
    }


    if (toAyahInput) {

        toAyahInput.value =
            '';
    }


    if (tomorrowRequirementInput) {

        tomorrowRequirementInput.value =
            '';
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
// تقييم السجل
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
        evaluations.length
    ) {

        return evaluations.join(
            ' - '
        );
    }


    return 'جيد';

}


// ============================================================
// التحقق
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
            : '';


    if (
        !Object.values(
            ATTENDANCE_STATUS
        ).includes(
            status
        )
    ) {

        showMessage(
            '⚠️ حالة الحضور غير صحيحة.'
        );

        return false;
    }


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


    const points =
        Number(
            pointsInput?.value ||
            0
        );


    if (
        !Number.isFinite(points) ||
        points < 0
    ) {

        showMessage(
            '⚠️ يرجى إدخال عدد نقاط صحيح.'
        );

        return false;
    }


    const lines =
        Number(
            linesInput?.value ||
            0
        );


    if (
        !Number.isFinite(lines) ||
        lines < 0
    ) {

        showMessage(
            '⚠️ يرجى إدخال عدد أسطر صحيح.'
        );

        return false;
    }


    return true;

}


// ============================================================
// تجهيز بيانات التعديل
// ============================================================

function buildUpdatedRecordData() {

    const status =
        statusSelect.value;


    let surah =
        surahInput?.value.trim() ||
        '';


    let fromAyah =
        fromAyahInput?.value.trim() ||
        '0';


    let toAyah =
        toAyahInput?.value.trim() ||
        '0';


    let tomorrowRequirement =
        tomorrowRequirementInput
            ?.value
            .trim() ||
        '';


    let notes =
        notesInput?.value.trim() ||
        '';


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
    }


    if (
        status ===
        ATTENDANCE_STATUS.PRESENT
    ) {

        tomorrowRequirement =
            tomorrowRequirement ||
            'لا يوجد';
    }


    return {

        status,

        surah,

        fromAyah,

        toAyah,

        grade:
            getGrade(status),

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
        saveBtn?.disabled
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

        saveBtn.innerHTML =
            '⏳ جاري الحفظ...';
    }


    try {

        // تحديث السجل

        await updateDoc(

            doc(
                db,
                'records',
                currentRecordId
            ),

            updatedData
        );


        // تحديث نقاط الطالب

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
                        increment(
                            pointsDifference
                        )
                }

            );
        }


        showMessage(
            '✅ تم تعديل السجل بنجاح.'
        );


        closeModal();


        // إعادة تحميل البيانات

        await init();


    } catch (error) {

        console.error(
            'Save Error:',
            error
        );


        showMessage(
            '❌ حدث خطأ أثناء حفظ التعديلات.\n\n' +
            (
                error.message ||
                String(error)
            )
        );

    } finally {

        if (saveBtn) {

            saveBtn.disabled =
                false;

            saveBtn.innerHTML =
                '💾 حفظ التعديلات';
        }

    }

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


    const statusInfo =
        getStatusInfo(
            record.status
        );


    const points =
        Number(
            record.pointsGiven ||
            0
        );


    const confirmed =
        confirm(

            `⚠️ هل أنت متأكد من حذف السجل؟\n\n` +

            `👤 الطالب: ${
                record.studentName ||
                'غير معروف'
            }\n` +

            `📖 الحلقة: ${
                record.halaqaName ||
                'غير محددة'
            }\n` +

            `📅 التاريخ: ${
                record.date ||
                'غير محدد'
            }\n` +

            `📌 الحالة: ${
                statusInfo.label
            }\n` +

            `⭐ النقاط: ${
                points
            }\n\n` +

            `سيتم خصم نقاط هذا السجل من مجموع نقاط الطالب.`

        );


    if (!confirmed) {

        return;
    }


    try {

        // حذف السجل

        await deleteDoc(

            doc(
                db,
                'records',
                record.id
            )
        );


        // خصم النقاط

        if (
            points !== 0 &&
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
                            increment(
                                -points
                            )
                    }

                );

            } catch (pointsError) {

                console.error(
                    'Points Update Error:',
                    pointsError
                );


                showMessage(
                    '⚠️ تم حذف السجل، لكن تعذر تحديث مجموع النقاط.\n\n' +
                    pointsError.message
                );


                await init();

                return;
            }

        }


        showMessage(
            '✅ تم حذف السجل وتحديث نقاط الطالب.'
        );


        await init();


    } catch (error) {

        console.error(
            'Delete Error:',
            error
        );


        showMessage(
            '❌ حدث خطأ أثناء حذف السجل.\n\n' +
            (
                error.message ||
                String(error)
            )
        );

    }

}


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


window.addEventListener(
    'keydown',
    event => {

        if (
            event.key === 'Escape' &&
            modal?.style.display === 'flex'
        ) {

            closeModal();
        }

    }
);


// ============================================================
// setValue
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
// تشغيل
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
