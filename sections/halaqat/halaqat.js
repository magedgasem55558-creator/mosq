// ============================================================
// 📖 رصد التسميع والحضور - حلقات القرآن
// halaqat.js
// ============================================================

import { db, loadHalaqatList } from '../../firebase.js';

import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ============================================================
// 🔹 عناصر الصفحة
// ============================================================

const halaqaFilter =
    document.getElementById('halaqaFilter');

const studentSelect =
    document.getElementById('studentIdSelect');

const attendanceStatus =
    document.getElementById('attendanceStatus');

const recitationFields =
    document.getElementById('recitationFields');

const saveButton =
    document.getElementById('saveRecitationBtn');

const currentSurah =
    document.getElementById('currentSurah');

const fromAya =
    document.getElementById('fromAya');

const toAya =
    document.getElementById('toAya');

const tomorrowReq =
    document.getElementById('tomorrowReq');

const teacherNotes =
    document.getElementById('teacherNotes');

const pointsGiven =
    document.getElementById('pointsGiven');

const attendanceSummary =
    document.getElementById('attendanceSummary');


// ============================================================
// 🔹 متغيرات التطبيق
// ============================================================

let halaqat = [];

const studentsCache = new Map();


// ============================================================
// 📅 تاريخ اليوم
// ============================================================

function getTodayDate() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1).padStart(2, '0');

    const day =
        String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}


// ============================================================
// 🔔 الرسائل
// ============================================================

function showMessage(message) {
    alert(message);
}


// ============================================================
// ⏳ حالة زر الحفظ
// ============================================================

function setButtonLoading(isLoading) {

    if (!saveButton) {
        return;
    }

    if (isLoading) {

        saveButton.disabled = true;

        saveButton.dataset.originalText =
            saveButton.textContent;

        saveButton.textContent =
            '⏳ جاري حفظ الرصد...';

    } else {

        saveButton.disabled = false;

        saveButton.textContent =
            saveButton.dataset.originalText ||
            '📤 حفظ وإرسال التحديث';
    }
}


// ============================================================
// 🧹 تنظيف النص
// ============================================================

function cleanText(value) {
    return String(value || '').trim();
}


// ============================================================
// 👨‍🎓 الطالب المختار
// ============================================================

function getSelectedStudent() {

    const studentId =
        studentSelect.value;

    if (!studentId) {
        return null;
    }

    return studentsCache.get(studentId) || null;
}


// ============================================================
// 📖 الحلقة المختارة
// ============================================================

function getSelectedHalaqa() {

    const halaqaId =
        halaqaFilter.value;

    if (!halaqaId) {
        return null;
    }

    return halaqat.find(
        halaqa => halaqa.id === halaqaId
    ) || null;
}


// ============================================================
// 🚀 تهيئة الصفحة
// ============================================================

async function initializePage() {

    try {

        if (
            !halaqaFilter ||
            !studentSelect ||
            !attendanceStatus ||
            !recitationFields ||
            !saveButton
        ) {
            throw new Error(
                'بعض عناصر الصفحة غير موجودة.'
            );
        }

        halaqat =
            await loadHalaqatList();

        if (!Array.isArray(halaqat)) {
            halaqat = [];
        }

        renderHalaqat();

        updateRecitationVisibility();

        updateAttendanceSummary(0, 0);

    } catch (error) {

        console.error(
            'Initialization Error:',
            error
        );

        showMessage(
            '❌ حدث خطأ أثناء تحميل الصفحة.\n\n' +
            error.message
        );
    }
}


// ============================================================
// 📚 عرض الحلقات
// ============================================================

function renderHalaqat() {

    halaqaFilter.innerHTML = '';

    const defaultOption =
        document.createElement('option');

    defaultOption.value = '';

    defaultOption.textContent =
        'اختر الحلقة...';

    halaqaFilter.appendChild(
        defaultOption
    );

    halaqat.forEach(halaqa => {

        const option =
            document.createElement('option');

        option.value =
            halaqa.id;

        const name =
            halaqa.name ||
            'حلقة بدون اسم';

        const teacher =
            halaqa.teacherName ||
            'غير محدد';

        option.textContent =
            `${name} - (الشيخ: ${teacher})`;

        halaqaFilter.appendChild(
            option
        );
    });
}


// ============================================================
// 📊 جلب رصد اليوم
// ============================================================

async function getTodayAttendance(halaqaId) {

    const today =
        getTodayDate();

    const recordsQuery =
        query(
            collection(db, 'records'),

            where(
                'halaqaId',
                '==',
                halaqaId
            ),

            where(
                'date',
                '==',
                today
            )
        );

    const snapshot =
        await getDocs(recordsQuery);

    const attendanceMap =
        new Map();

    snapshot.forEach(recordDoc => {

        const record =
            recordDoc.data();

        if (!record.studentId) {
            return;
        }

        attendanceMap.set(
            record.studentId,
            {
                status:
                    record.status || '',

                grade:
                    record.grade || '',

                pointsGiven:
                    Number(
                        record.pointsGiven || 0
                    )
            }
        );
    });

    return attendanceMap;
}


// ============================================================
// 👨‍🎓 تحميل طلاب الحلقة
// ============================================================

async function loadStudentsByHalaqa(halaqaId) {

    studentSelect.innerHTML = '';

    studentsCache.clear();

    const loadingOption =
        document.createElement('option');

    loadingOption.value = '';

    loadingOption.textContent =
        '⏳ جاري تحميل الطلاب...';

    studentSelect.appendChild(
        loadingOption
    );

    studentSelect.disabled = true;

    try {

        const [
            studentsSnapshot,
            todayAttendance
        ] = await Promise.all([

            getDocs(
                query(
                    collection(
                        db,
                        'students'
                    ),

                    where(
                        'halaqaId',
                        '==',
                        halaqaId
                    )
                )
            ),

            getTodayAttendance(
                halaqaId
            )
        ]);


        // ----------------------------------------------------
        // لا يوجد طلاب
        // ----------------------------------------------------

        if (studentsSnapshot.empty) {

            studentSelect.innerHTML = '';

            const emptyOption =
                document.createElement('option');

            emptyOption.value = '';

            emptyOption.textContent =
                'لا يوجد طلاب في هذه الحلقة';

            studentSelect.appendChild(
                emptyOption
            );

            studentSelect.disabled = true;

            updateAttendanceSummary(0, 0);

            return;
        }


        // ----------------------------------------------------
        // الخيار الافتراضي
        // ----------------------------------------------------

        studentSelect.innerHTML = '';

        const defaultOption =
            document.createElement('option');

        defaultOption.value = '';

        defaultOption.textContent =
            'اختر الطالب...';

        studentSelect.appendChild(
            defaultOption
        );


        // ----------------------------------------------------
        // تحويل الطلاب إلى Array
        // ----------------------------------------------------

        const students = [];

        studentsSnapshot.forEach(studentDoc => {

            const student =
                studentDoc.data();

            students.push({
                id: studentDoc.id,
                ...student
            });
        });


        // ----------------------------------------------------
        // ترتيب أبجدي
        // ----------------------------------------------------

        students.sort((a, b) => {

            const nameA =
                String(a.name || '');

            const nameB =
                String(b.name || '');

            return nameA.localeCompare(
                nameB,
                'ar'
            );
        });


        // ----------------------------------------------------
        // إحصائيات
        // ----------------------------------------------------

        let recordedCount = 0;


        // ----------------------------------------------------
        // إنشاء الطلاب
        // ----------------------------------------------------

        students.forEach(student => {

            studentsCache.set(
                student.id,
                student
            );

            const option =
                document.createElement('option');

            option.value =
                student.id;

            const studentName =
                student.name ||
                'طالب بدون اسم';

            const attendance =
                todayAttendance.get(
                    student.id
                );


            // ------------------------------------------------
            // تم الرصد
            // ------------------------------------------------

            if (attendance) {

                recordedCount++;

                let icon = '✅';

                let statusText =
                    'تم الرصد';


                switch (attendance.status) {

                    case 'حاضر':

                        icon = '✅';

                        statusText =
                            'حاضر';

                        break;


                    case 'غائب':

                        icon = '❌';

                        statusText =
                            'غائب';

                        break;


                    case 'إجازة':

                        icon = '🔵';

                        statusText =
                            'إجازة';

                        break;


                    case 'مستأذن':

                        icon = '🟠';

                        statusText =
                            'مستأذن';

                        break;


                    default:

                        icon = '✅';

                        statusText =
                            'تم الرصد';
                }


                option.textContent =
                    `${icon} ${studentName} — ${statusText}`;

                option.dataset.recorded =
                    'true';

                option.dataset.status =
                    attendance.status || '';

            }


            // ------------------------------------------------
            // لم يتم الرصد
            // ------------------------------------------------

            else {

                option.textContent =
                    `⬜ ${studentName} — لم يُرصد`;

                option.dataset.recorded =
                    'false';

                option.dataset.status =
                    '';
            }


            studentSelect.appendChild(
                option
            );
        });


        studentSelect.disabled = false;


        updateAttendanceSummary(
            students.length,
            recordedCount
        );


    } catch (error) {

        console.error(
            'Load Students Error:',
            error
        );

        studentSelect.innerHTML = '';

        const errorOption =
            document.createElement('option');

        errorOption.value = '';

        errorOption.textContent =
            '❌ تعذر تحميل الطلاب';

        studentSelect.appendChild(
            errorOption
        );

        studentSelect.disabled = true;

        updateAttendanceSummary(0, 0);

        showMessage(
            '❌ تعذر تحميل بيانات الطلاب.\n\n' +
            error.message
        );
    }
}


// ============================================================
// 📊 ملخص الرصد
// ============================================================

function updateAttendanceSummary(
    total,
    recorded
) {

    if (!attendanceSummary) {
        return;
    }

    const remaining =
        Math.max(total - recorded, 0);

    const percentage =
        total > 0
            ? Math.round(
                (recorded / total) * 100
            )
            : 0;


    attendanceSummary.innerHTML = `
        <div class="summary-header">
            <span>📊 حالة رصد اليوم</span>
            <strong>${percentage}%</strong>
        </div>

        <div class="summary-stats">

            <div class="summary-item total">
                <span class="summary-icon">👥</span>
                <div>
                    <small>إجمالي الطلاب</small>
                    <strong>${total}</strong>
                </div>
            </div>

            <div class="summary-item recorded">
                <span class="summary-icon">✅</span>
                <div>
                    <small>تم الرصد</small>
                    <strong>${recorded}</strong>
                </div>
            </div>

            <div class="summary-item remaining">
                <span class="summary-icon">⬜</span>
                <div>
                    <small>المتبقي</small>
                    <strong>${remaining}</strong>
                </div>
            </div>

        </div>

        <div class="summary-progress">
            <div style="width:${percentage}%"></div>
        </div>
    `;
}


// ============================================================
// 🔄 تغيير الحلقة
// ============================================================

halaqaFilter.addEventListener(
    'change',
    async () => {

        const halaqaId =
            halaqaFilter.value;

        studentSelect.innerHTML =
            '<option value="">اختر الطالب...</option>';

        studentSelect.disabled = true;

        studentsCache.clear();

        updateAttendanceSummary(0, 0);

        if (!halaqaId) {
            return;
        }

        await loadStudentsByHalaqa(
            halaqaId
        );
    }
);


// ============================================================
// 👨‍🎓 عند اختيار الطالب
// ============================================================

studentSelect.addEventListener(
    'change',
    () => {

        const selectedOption =
            studentSelect.options[
                studentSelect.selectedIndex
            ];

        if (
            !selectedOption ||
            !selectedOption.value
        ) {
            return;
        }

        const recorded =
            selectedOption.dataset.recorded ===
            'true';

        if (!recorded) {
            return;
        }

        const status =
            selectedOption.dataset.status ||
            'تم الرصد';

        console.log(
            `الطالب تم رصده اليوم: ${status}`
        );
    }
);


// ============================================================
// 🟢 تغيير حالة الحضور
// ============================================================

attendanceStatus.addEventListener(
    'change',
    updateRecitationVisibility
);


function updateRecitationVisibility() {

    const status =
        attendanceStatus.value;

    const isPresent =
        status === 'حاضر';


    // --------------------------------------------------------
    // التسميع يظهر للحاضر فقط
    // --------------------------------------------------------

    recitationFields.style.display =
        isPresent
            ? 'block'
            : 'none';


    // --------------------------------------------------------
    // النقاط
    // --------------------------------------------------------

    pointsGiven.value =
        isPresent
            ? '10'
            : '0';


    // --------------------------------------------------------
    // إذا لم يكن حاضرًا
    // --------------------------------------------------------

    if (!isPresent) {

        currentSurah.value = '';

        fromAya.value = '';

        toAya.value = '';


        document
            .querySelectorAll('.eval-check')
            .forEach(checkbox => {

                checkbox.checked =
                    false;
            });
    }
}


// ============================================================
// 🔎 التحقق من البيانات
// ============================================================

function validateForm() {

    const halaqaId =
        halaqaFilter.value;

    const studentId =
        studentSelect.value;

    const status =
        attendanceStatus.value;


    if (!halaqaId) {

        showMessage(
            '⚠️ يرجى اختيار الحلقة أولاً.'
        );

        return false;
    }


    if (!studentId) {

        showMessage(
            '⚠️ يرجى اختيار الطالب.'
        );

        return false;
    }


    if (!status) {

        showMessage(
            '⚠️ يرجى اختيار حالة الحضور.'
        );

        return false;
    }


    // --------------------------------------------------------
    // الرصد المكرر
    // --------------------------------------------------------

    const selectedOption =
        studentSelect.options[
            studentSelect.selectedIndex
        ];


    if (
        selectedOption &&
        selectedOption.dataset.recorded ===
        'true'
    ) {

        const existingStatus =
            selectedOption.dataset.status ||
            'تم الرصد';


        const confirmAgain =
            confirm(
                `⚠️ الطالب تم رصده اليوم بالفعل.\n\n` +
                `الحالة الحالية: ${existingStatus}\n\n` +
                `هل تريد إضافة رصد جديد له؟`
            );


        if (!confirmAgain) {
            return false;
        }
    }


    // --------------------------------------------------------
    // التحقق من التسميع للحاضر
    // --------------------------------------------------------

    if (status === 'حاضر') {

        if (
            !cleanText(
                currentSurah.value
            )
        ) {

            showMessage(
                '⚠️ يرجى إدخال اسم السورة.'
            );

            currentSurah.focus();

            return false;
        }


        const from =
            Number(
                fromAya.value || 0
            );

        const to =
            Number(
                toAya.value || 0
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


    // --------------------------------------------------------
    // التحقق من النقاط
    // --------------------------------------------------------

    const points =
        Number(
            pointsGiven.value || 0
        );


    if (
        !Number.isFinite(points) ||
        points < 0
    ) {

        showMessage(
            '⚠️ يرجى إدخال عدد نقاط صحيح.'
        );

        pointsGiven.focus();

        return false;
    }


    return true;
}


// ============================================================
// ⭐ الحصول على التقييم
// ============================================================

function getGrade(status) {

    if (status !== 'حاضر') {
        return '-';
    }


    const evaluations = [];


    document
        .querySelectorAll('.eval-check:checked')
        .forEach(checkbox => {

            evaluations.push(
                checkbox.value
            );
        });


    if (evaluations.length > 0) {

        return evaluations.join(
            ' - '
        );
    }


    return 'جيد';
}


// ============================================================
// 📤 حفظ الرصد
// ============================================================

saveButton.addEventListener(
    'click',
    saveRecitation
);


async function saveRecitation() {

    if (saveButton.disabled) {
        return;
    }


    if (!validateForm()) {
        return;
    }


    const halaqaId =
        halaqaFilter.value;

    const studentId =
        studentSelect.value;

    const status =
        attendanceStatus.value;


    const selectedHalaqa =
        getSelectedHalaqa();

    const selectedStudent =
        getSelectedStudent();


    if (!selectedHalaqa) {

        showMessage(
            '❌ تعذر العثور على بيانات الحلقة.'
        );

        return;
    }


    if (!selectedStudent) {

        showMessage(
            '❌ تعذر العثور على بيانات الطالب.'
        );

        return;
    }


    // --------------------------------------------------------
    // البيانات
    // --------------------------------------------------------

    const surah =
        cleanText(
            currentSurah.value
        );


    const from =
        cleanText(
            fromAya.value
        ) || '0';


    const to =
        cleanText(
            toAya.value
        ) || '0';


    const tomorrowRequirement =
        cleanText(
            tomorrowReq.value
        ) || 'لا يوجد';


    const notes =
        cleanText(
            teacherNotes.value
        );


    let points =
        Number(
            pointsGiven.value || 0
        );


    // --------------------------------------------------------
    // لا نقاط لغير الحاضر
    // --------------------------------------------------------

    if (status !== 'حاضر') {
        points = 0;
    }


    const grade =
        getGrade(status);


    const teacherPhone =
        selectedHalaqa.teacherPhone ||
        '967770000000';


    // ========================================================
    // 📝 بيانات سجل Firestore
    // ========================================================

    const recordData = {

        // ----------------------------------------------------
        // الطالب
        // ----------------------------------------------------

        studentId,

        studentName:
            selectedStudent.name || '',


        // ----------------------------------------------------
        // الحلقة
        // ----------------------------------------------------

        halaqaId,

        halaqaName:
            selectedHalaqa.name || '',


        // ----------------------------------------------------
        // الشيخ
        // ----------------------------------------------------

        teacherName:
            selectedHalaqa.teacherName || '',

        teacherPhone,


        // ----------------------------------------------------
        // الحضور
        // ----------------------------------------------------

        status,


        // ----------------------------------------------------
        // التسميع
        // ----------------------------------------------------

        surah:
            status === 'حاضر'
                ? surah
                : status,

        fromAyah:
            from,

        toAyah:
            to,


        // ----------------------------------------------------
        // التقييم
        // ----------------------------------------------------

        grade,


        // ----------------------------------------------------
        // خطة الغد
        // ----------------------------------------------------

        tomorrowRequirement,


        // ----------------------------------------------------
        // ملاحظات الشيخ
        // ----------------------------------------------------

        notes,


        // ----------------------------------------------------
        // النقاط
        // ----------------------------------------------------

        pointsGiven:
            points,


        // ----------------------------------------------------
        // التاريخ
        // ----------------------------------------------------

        date:
            getTodayDate(),


        // ----------------------------------------------------
        // وقت التسجيل
        // ----------------------------------------------------

        timestamp:
            serverTimestamp()
    };


    setButtonLoading(true);


    try {

        // ====================================================
        // إضافة السجل
        // ====================================================

        await addDoc(
            collection(
                db,
                'records'
            ),
            recordData
        );


        // ====================================================
        // تحديث نقاط الطالب
        // ====================================================

        if (
            status === 'حاضر' &&
            points > 0
        ) {

            await updateDoc(

                doc(
                    db,
                    'students',
                    studentId
                ),

                {
                    totalPoints:
                        increment(points)
                }
            );
        }


        // ====================================================
        // رسالة النجاح
        // ====================================================

        showMessage(
            `✅ تم حفظ الرصد بنجاح\n\n` +
            `👤 الطالب: ${selectedStudent.name}\n` +
            `📌 الحالة: ${status}\n` +
            `⭐ النقاط: ${points}\n` +
            `📊 التقييم: ${grade}`
        );


        // ====================================================
        // إعادة تحميل القائمة
        // ====================================================

        await loadStudentsByHalaqa(
            halaqaId
        );


        // ====================================================
        // تنظيف النموذج
        // ====================================================

        resetFormAfterSave();


    } catch (error) {

        console.error(
            'Save Record Error:',
            error
        );


        showMessage(
            '❌ حدث خطأ أثناء حفظ الرصد.\n\n' +
            error.message
        );


    } finally {

        setButtonLoading(false);
    }
}


// ============================================================
// 🧹 تنظيف النموذج بعد الحفظ
// ============================================================

function resetFormAfterSave() {

    currentSurah.value = '';

    fromAya.value = '';

    toAya.value = '';

    tomorrowReq.value = '';

    teacherNotes.value = '';


    pointsGiven.value =
        attendanceStatus.value === 'حاضر'
            ? '10'
            : '0';


    document
        .querySelectorAll('.eval-check')
        .forEach(checkbox => {

            checkbox.checked =
                false;
        });
}


// ============================================================
// 🚀 تشغيل الصفحة
// ============================================================

initializePage();
