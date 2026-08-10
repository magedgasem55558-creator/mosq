import {
    db,
    auth,
    loadAllStudents
} from '../../../firebase.js';

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// ============================================================
// العناصر
// ============================================================

const $ = id =>
    document.getElementById(id);


// ============================================================
// عناصر لوحة التحكم
// ============================================================

const studentSelect =
    $('studentSelect');

const studentSearchInput =
    $('studentSearchInput');

const studentSearchClear =
    $('studentSearchClear');

const studentDropdown =
    $('studentDropdown');

const studentPicker =
    $('studentPicker');

const monthSelect =
    $('monthSelect');

const reportTypeSelect =
    $('reportType');

const reportNotes =
    $('reportNotes');

const generatePdfBtn =
    $('generatePdfBtn');

const refreshReportBtn =
    $('refreshReportBtn');

const previewStatus =
    $('previewStatus');


// ============================================================
// بيانات التقرير
// ============================================================

const pdfReportBadge =
    $('pdfReportBadge');

const pdfMainTitle =
    $('pdfMainTitle');

const pdfReportPeriod =
    $('pdfReportPeriod');

const pdfReportType =
    $('pdfReportType');

const pdfStudentName =
    $('pdfStudentName');

const pdfHalaqaName =
    $('pdfHalaqaName');

const pdfMonth =
    $('pdfMonth');


// ============================================================
// الإحصائيات
// ============================================================

const pdfAttendCount =
    $('pdfAttendCount');

const pdfAbsentCount =
    $('pdfAbsentCount');

const pdfRecitations =
    $('pdfRecitations');

const pdfPoints =
    $('pdfPoints');

const pdfAttendanceRate =
    $('pdfAttendanceRate');

const pdfAttendanceProgress =
    $('pdfAttendanceProgress');

const pdfAveragePoints =
    $('pdfAveragePoints');

const pdfStudentCount =
    $('pdfStudentCount');

const pdfRecordsCount =
    $('pdfRecordsCount');


// ============================================================
// الحالات
// ============================================================

const pdfPresentStatus =
    $('pdfPresentStatus');

const pdfAbsentStatus =
    $('pdfAbsentStatus');

const pdfLeaveStatus =
    $('pdfLeaveStatus');

const pdfPermissionStatus =
    $('pdfPermissionStatus');

const pdfReviewStatus =
    $('pdfReviewStatus');


// ============================================================
// الأقسام
// ============================================================

const studentSummarySection =
    $('studentSummarySection');

const detailedSection =
    $('detailedSection');

const achievementSection =
    $('achievementSection');

const pdfSummaryText =
    $('pdfSummaryText');

const pdfAchievement =
    $('pdfAchievement');

const pdfTableBody =
    $('pdfTableBody');

const pdfNotesText =
    $('pdfNotesText');


// ============================================================
// التخزين المؤقت
// ============================================================

let studentsCache = [];

let currentReportData = null;

let updateTimer = null;


// ============================================================
// حالة البحث
// ============================================================

let selectedStudent = null;


// ============================================================
// المصادقة
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            setStatus(
                'يرجى تسجيل الدخول',
                'error'
            );

            studentSearchInput.value =
                '';

            studentSearchInput.placeholder =
                '⚠️ يرجى تسجيل الدخول أولاً';

            studentSearchInput.disabled =
                true;

            return;
        }

        await init();
    }
);


// ============================================================
// التهيئة
// ============================================================

async function init() {

    try {

        setStatus(
            'جاري تحميل البيانات...',
            'loading'
        );


        // الشهر الحالي

        const now =
            new Date();


        const currentMonth =
            `${now.getFullYear()}-${String(
                now.getMonth() + 1
            ).padStart(2, '0')}`;


        monthSelect.value =
            currentMonth;


        // تحميل الطلاب فقط

        const students =
            await loadAllStudents();


        /*
         * نفس منطق صفحة الرصد:
         *
         * isActive === false
         *
         * يعني الطالب غير نشط ويتم استبعاده.
         */

        studentsCache =
            Array.isArray(students)

                ? students
                    .filter(
                        student =>
                            student.isActive !== false
                    )
                    .map(
                        student => ({

                            ...student,

                            halaqaName:
                                student.halaqaName ||
                                'غير محدد'

                        })
                    )

                : [];


        setupStudentSearch();

        setupEvents();

        updateStudentDropdown(
            ''
        );


        await updateReportPreview();


        setStatus(
            'جاهز',
            'success'
        );

    } catch (error) {

        console.error(
            'Reports Init Error:',
            error
        );


        setStatus(
            'تعذر تحميل البيانات',
            'error'
        );
    }
}


// ============================================================
// البحث عن الطالب
// ============================================================

function setupStudentSearch() {

    // فتح القائمة عند الضغط

    studentSearchInput.addEventListener(
        'focus',
        () => {

            studentDropdown.classList.add(
                'open'
            );

            updateStudentDropdown(
                studentSearchInput.value
            );
        }
    );


    studentSearchInput.addEventListener(
        'click',
        () => {

            studentDropdown.classList.add(
                'open'
            );

            updateStudentDropdown(
                studentSearchInput.value
            );
        }
    );


    // البحث أثناء الكتابة

    studentSearchInput.addEventListener(
        'input',
        () => {

            const search =
                studentSearchInput.value.trim();


            /*
             * إذا بدأ المستخدم بتغيير النص
             * بعد اختيار طالب، يتم إلغاء الاختيار.
             */

            if (
                selectedStudent &&
                search !== selectedStudent.name
            ) {

                selectedStudent =
                    null;

                studentSelect.value =
                    '';

                schedulePreview();
            }


            studentSearchClear.style.display =
                search
                    ? 'flex'
                    : 'none';


            studentDropdown.classList.add(
                'open'
            );


            updateStudentDropdown(
                search
            );
        }
    );


    // زر المسح

    studentSearchClear.addEventListener(
        'click',
        event => {

            event.stopPropagation();


            selectedStudent =
                null;


            studentSelect.value =
                '';


            studentSearchInput.value =
                '';


            studentSearchClear.style.display =
                'none';


            updateStudentDropdown(
                ''
            );


            studentSearchInput.focus();


            schedulePreview();
        }
    );


    // إغلاق القائمة عند الضغط خارجها

    document.addEventListener(
        'click',
        event => {

            if (
                !studentPicker.contains(
                    event.target
                )
            ) {

                studentDropdown.classList.remove(
                    'open'
                );
            }
        }
    );
}


// ============================================================
// تعبئة قائمة الطلاب
// ============================================================

function updateStudentDropdown(
    searchText = ''
) {

    const search =
        String(
            searchText || ''
        )
            .trim()
            .toLocaleLowerCase('ar');


    studentDropdown.innerHTML =
        '';


    let students =
        studentsCache
            .slice()
            .sort(
                (a, b) =>
                    String(a.name || '')
                        .localeCompare(
                            String(b.name || ''),
                            'ar'
                        )
            );


    // البحث بالاسم

    if (search) {

        students =
            students.filter(
                student => {

                    const name =
                        String(
                            student.name || ''
                        )
                            .toLocaleLowerCase('ar');


                    return name.includes(
                        search
                    );
                }
            );
    }


    // لا توجد نتائج

    if (!students.length) {

        const empty =
            document.createElement(
                'div'
            );


        empty.className =
            'student-dropdown-empty';


        empty.textContent =
            search
                ? 'لا يوجد طالب بهذا الاسم'
                : 'لا يوجد طلاب متاحون';


        studentDropdown.appendChild(
            empty
        );


        return;
    }


    // عرض النتائج

    students.forEach(
        student => {

            const item =
                document.createElement(
                    'button'
                );


            item.type =
                'button';


            item.className =
                'student-option';


            if (
                selectedStudent &&
                selectedStudent.id ===
                student.id
            ) {

                item.classList.add(
                    'selected'
                );
            }


            item.innerHTML = `

                <span class="student-option-icon">
                    👤
                </span>

                <span class="student-option-info">

                    <strong>
                        ${escapeHtml(
                            student.name ||
                            'طالب بدون اسم'
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            student.halaqaName ||
                            'غير محدد'
                        )}
                    </small>

                </span>

            `;


            item.addEventListener(
                'click',
                () => {

                    selectStudent(
                        student
                    );
                }
            );


            studentDropdown.appendChild(
                item
            );
        }
    );
}


// ============================================================
// اختيار الطالب
// ============================================================

function selectStudent(
    student
) {

    selectedStudent =
        student;


    studentSelect.value =
        student.id;


    studentSearchInput.value =
        student.name || '';


    studentSearchClear.style.display =
        'flex';


    studentDropdown.classList.remove(
        'open'
    );


    schedulePreview();
}


// ============================================================
// الأحداث
// ============================================================

function setupEvents() {

    monthSelect.addEventListener(
        'change',
        schedulePreview
    );


    reportTypeSelect.addEventListener(
        'change',
        schedulePreview
    );


    reportNotes.addEventListener(
        'input',
        updateNotes
    );


    refreshReportBtn.addEventListener(
        'click',
        async () => {

            await updateReportPreview();
        }
    );


    generatePdfBtn.addEventListener(
        'click',
        downloadPDF
    );
}


// ============================================================
// تأخير التحديث
// ============================================================

function schedulePreview() {

    clearTimeout(
        updateTimer
    );


    updateTimer =
        setTimeout(
            updateReportPreview,
            250
        );
}


// ============================================================
// تحديث التقرير
// ============================================================

async function updateReportPreview() {

    const month =
        monthSelect.value;


    const reportType =
        reportTypeSelect.value;


    if (!month) {
        return;
    }


    setStatus(
        'جاري إعداد التقرير...',
        'loading'
    );


    resetReport();


    try {

        await generateStudentReport(
            month,
            reportType
        );


        updateNotes();


        currentReportData = {

            scope:
                'student',

            month,

            reportType

        };


        setStatus(
            'التقرير جاهز',
            'success'
        );

    } catch (error) {

        console.error(
            'Report Preview Error:',
            error
        );


        setStatus(
            'تعذر إنشاء التقرير',
            'error'
        );
    }
}


// ============================================================
// تقرير الطالب
// ============================================================

async function generateStudentReport(
    month,
    reportType
) {

    const studentId =
        studentSelect.value;


    pdfReportType.textContent =
        'تقرير طالب';


    pdfReportPeriod.textContent =
        `الفترة: ${formatMonth(month)}`;


    // لم يتم اختيار طالب

    if (!studentId) {

        pdfReportBadge.textContent =
            'تقرير أداء الطالب';


        pdfMainTitle.textContent =
            'تقرير الأداء والمتابعة';


        pdfStudentName.textContent =
            'يرجى اختيار طالب';


        pdfHalaqaName.textContent =
            '-';


        studentSummarySection.style.display =
            'block';


        detailedSection.style.display =
            'none';


        achievementSection.style.display =
            'none';


        pdfSummaryText.innerHTML = `

            <strong>
                لم يتم اختيار طالب بعد.
            </strong>

            <br>

            اضغط على حقل الطالب واكتب اسمه
            للبحث عنه ثم اختره لعرض التقرير.

        `;


        return;
    }


    const student =
        studentsCache.find(
            item =>
                item.id === studentId
        );


    if (!student) {

        selectedStudent =
            null;

        studentSelect.value =
            '';


        return;
    }


    // جلب سجلات الطالب

    const records =
        await fetchStudentRecordsForMonth(
            studentId,
            month
        );


    // حساب الإحصائيات

    const stats =
        calculateStats(
            records
        );


    // الرأس

    fillHeader({

        badge:
            reportType === 'summary'
                ? 'تقرير أداء مختصر'
                : 'تقرير أداء تفصيلي',

        title:
            'تقرير أداء الطالب',

        type:
            'تقرير طالب',

        name:
            student.name ||
            'طالب بدون اسم',

        halaqa:
            student.halaqaName ||
            'غير محدد',

        month

    });


    // الإحصائيات

    fillStats(
        stats,
        1,
        records.length
    );


    // الأقسام

    studentSummarySection.style.display =
        reportType === 'summary'
            ? 'block'
            : 'none';


    detailedSection.style.display =
        reportType === 'detailed'
            ? 'block'
            : 'none';


    achievementSection.style.display =
        'block';


    // المحتوى

    if (
        reportType === 'summary'
    ) {

        generateStudentSummary(
            records,
            stats
        );
    }


    if (
        reportType === 'detailed'
    ) {

        generateStudentDetailedReport(
            records
        );
    }


    generateAchievement(
        records
    );
}


// ============================================================
// جلب سجلات الطالب للشهر
// ============================================================

async function fetchStudentRecordsForMonth(
    studentId,
    month
) {

    try {

        const q =
            query(
                collection(
                    db,
                    'records'
                ),
                where(
                    'studentId',
                    '==',
                    studentId
                )
            );


        const snapshot =
            await getDocs(q);


        const records = [];


        snapshot.forEach(
            docSnap => {

                const data =
                    docSnap.data();


                if (
                    isRecordInMonth(
                        data.date,
                        month
                    )
                ) {

                    records.push({

                        id:
                            docSnap.id,

                        ...data

                    });
                }
            }
        );


        return sortRecords(
            records
        );

    } catch (error) {

        console.error(
            'Student Records Error:',
            error
        );


        return [];
    }
}


// ============================================================
// Timestamp -> Date
// ============================================================

function timestampToDate(
    value
) {

    if (!value) {
        return null;
    }


    // Firestore Timestamp

    if (
        typeof value.toDate ===
        'function'
    ) {

        const date =
            value.toDate();


        return isNaN(
            date.getTime()
        )
            ? null
            : date;
    }


    // Date

    if (
        value instanceof Date
    ) {

        return isNaN(
            value.getTime()
        )
            ? null
            : value;
    }


    // Firestore Timestamp object

    if (
        typeof value === 'object' &&
        typeof value.seconds === 'number'
    ) {

        const milliseconds =
            value.seconds * 1000 +
            Math.floor(
                (Number(
                    value.nanoseconds
                ) || 0) / 1000000
            );


        const date =
            new Date(
                milliseconds
            );


        return isNaN(
            date.getTime()
        )
            ? null
            : date;
    }


    // رقم

    if (
        typeof value === 'number'
    ) {

        const date =
            new Date(value);


        return isNaN(
            date.getTime()
        )
            ? null
            : date;
    }


    // نص

    if (
        typeof value === 'string'
    ) {

        // YYYY-MM-DD

        if (
            /^\d{4}-\d{2}-\d{2}$/.test(
                value
            )
        ) {

            const [
                year,
                month,
                day
            ] =
                value
                    .split('-')
                    .map(Number);


            const date =
                new Date(
                    year,
                    month - 1,
                    day
                );


            return isNaN(
                date.getTime()
            )
                ? null
                : date;
        }


        const date =
            new Date(value);


        return isNaN(
            date.getTime()
        )
            ? null
            : date;
    }


    return null;
}


// ============================================================
// هل السجل داخل الشهر؟
// ============================================================

function isRecordInMonth(
    dateValue,
    month
) {

    const date =
        timestampToDate(
            dateValue
        );


    if (
        !date ||
        !month
    ) {

        return false;
    }


    const [
        year,
        monthNumber
    ] =
        month
            .split('-')
            .map(Number);


    return (
        date.getFullYear() === year &&
        date.getMonth() + 1 === monthNumber
    );
}


// ============================================================
// ترتيب السجلات
// ============================================================

function sortRecords(
    records
) {

    return records.sort(
        (a, b) => {

            const dateA =
                timestampToDate(
                    a.date
                );


            const dateB =
                timestampToDate(
                    b.date
                );


            if (
                !dateA &&
                !dateB
            ) {

                return 0;
            }


            if (!dateA) {
                return 1;
            }


            if (!dateB) {
                return -1;
            }


            return (
                dateA.getTime() -
                dateB.getTime()
            );
        }
    );
}


// ============================================================
// الإحصائيات
// ============================================================

function calculateStats(
    records
) {

    const stats = {

        total:
            records.length,

        attendance:
            0,

        absence:
            0,

        leave:
            0,

        permission:
            0,

        review:
            0,

        recitations:
            0,

        points:
            0,

        averagePoints:
            0,

        attendanceRate:
            0

    };


    records.forEach(
        record => {

            const status =
                String(
                    record.status || ''
                ).trim();


            switch (status) {

                case 'حاضر':

                    stats.attendance++;
                    break;


                case 'غائب':

                    stats.absence++;
                    break;


                case 'إجازة':

                    stats.leave++;
                    break;


                case 'مستأذن':

                    stats.permission++;
                    break;


                case 'مراجعة':

                    stats.review++;
                    break;

            }


            if (
                status === 'حاضر' &&
                record.surah
            ) {

                stats.recitations++;
            }


            stats.points +=
                Number(
                    record.pointsGiven
                ) || 0;
        }
    );


    const attendanceBase =
        stats.attendance +
        stats.absence;


    stats.attendanceRate =
        attendanceBase > 0

            ? Math.round(
                (
                    stats.attendance /
                    attendanceBase
                ) * 100
            )

            : 0;


    stats.averagePoints =
        records.length > 0

            ? Number(
                (
                    stats.points /
                    records.length
                ).toFixed(1)
            )

            : 0;


    return stats;
}


// ============================================================
// تعبئة الرأس
// ============================================================

function fillHeader(
    data
) {

    pdfReportBadge.textContent =
        data.badge || '-';


    pdfMainTitle.textContent =
        data.title || '-';


    pdfReportType.textContent =
        data.type || '-';


    pdfStudentName.textContent =
        data.name || '-';


    pdfHalaqaName.textContent =
        data.halaqa || '-';


    pdfMonth.textContent =
        formatMonth(
            data.month
        );


    pdfReportPeriod.textContent =
        `الفترة: ${formatMonth(
            data.month
        )}`;
}


// ============================================================
// تعبئة الإحصائيات
// ============================================================

function fillStats(
    stats,
    studentCount,
    recordCount
) {

    pdfAttendCount.textContent =
        stats.attendance;


    pdfAbsentCount.textContent =
        stats.absence;


    pdfRecitations.textContent =
        stats.recitations;


    pdfPoints.textContent =
        stats.points;


    pdfAttendanceRate.textContent =
        `${stats.attendanceRate}%`;


    pdfAttendanceProgress.style.width =
        `${stats.attendanceRate}%`;


    pdfAveragePoints.textContent =
        stats.averagePoints;


    pdfStudentCount.textContent =
        studentCount;


    pdfRecordsCount.textContent =
        recordCount;


    pdfPresentStatus.textContent =
        stats.attendance;


    pdfAbsentStatus.textContent =
        stats.absence;


    pdfLeaveStatus.textContent =
        stats.leave;


    pdfPermissionStatus.textContent =
        stats.permission;


    pdfReviewStatus.textContent =
        stats.review;
}


// ============================================================
// ملخص الطالب
// ============================================================

function generateStudentSummary(
    records,
    stats
) {

    const recitations =
        records.filter(
            record =>
                record.status === 'حاضر' &&
                record.surah
        );


    if (!records.length) {

        pdfSummaryText.innerHTML = `

            <strong>
                لا توجد سجلات خلال هذه الفترة.
            </strong>

            <br>

            لم يتم تسجيل أي حضور أو متابعة
            لهذا الطالب خلال الشهر المحدد.

        `;

        return;
    }


    const first =
        recitations[0];


    const last =
        recitations[
            recitations.length - 1
        ];


    const latest =
        recitations[
            recitations.length - 1
        ];


    pdfSummaryText.innerHTML = `

        <div>

            <strong>
                الملخص العام:
            </strong>

            تم تسجيل
            <strong>
                ${stats.total}
            </strong>
            سجلًا خلال الفترة، منها
            <strong>
                ${stats.attendance}
            </strong>
            حضورًا و
            <strong>
                ${stats.absence}
            </strong>
            غيابًا، مع نسبة حضور بلغت
            <strong>
                ${stats.attendanceRate}%
            </strong>.

            وقد بلغ إجمالي النقاط
            <strong>
                ${stats.points}
            </strong>
            نقطة.

        </div>


        <div class="summary-highlight">

            <div>

                <span>
                    جلسات التسميع
                </span>

                <strong>
                    ${stats.recitations}
                </strong>

            </div>


            <div>

                <span>
                    بداية الإنجاز
                </span>

                <strong>

                    ${
                        first

                            ? `سورة ${escapeHtml(
                                first.surah
                            )} — آية ${escapeHtml(
                                first.fromAyah || '1'
                            )}`

                            : '-'
                    }

                </strong>

            </div>


            <div>

                <span>
                    آخر إنجاز
                </span>

                <strong>

                    ${
                        last

                            ? `سورة ${escapeHtml(
                                last.surah
                            )} — آية ${escapeHtml(
                                last.toAyah || 'النهاية'
                            )}`

                            : '-'
                    }

                </strong>

            </div>

        </div>


        ${
            latest?.tomorrowRequirement &&
            latest.tomorrowRequirement !== 'لا يوجد'

                ? `

                    <div style="margin-top:10px;">

                        <strong>
                            متطلب المتابعة القادمة:
                        </strong>

                        ${escapeHtml(
                            latest.tomorrowRequirement
                        )}

                    </div>

                `

                : ''
        }

    `;
}


// ============================================================
// الإنجاز القرآني
// ============================================================

function generateAchievement(
    records
) {

    const recitations =
        records.filter(
            record =>
                record.status === 'حاضر' &&
                record.surah
        );


    if (!recitations.length) {

        pdfAchievement.textContent =
            'لا توجد بيانات تسميع كافية لعرض الإنجاز القرآني.';

        return;
    }


    const first =
        recitations[0];


    const last =
        recitations[
            recitations.length - 1
        ];


    pdfAchievement.innerHTML = `

        <div class="achievement-main">

            <div>

                <div class="achievement-title">
                    المسار المسجل خلال الفترة
                </div>


                <div style="margin-top:6px;">

                    البداية:

                    <strong>

                        سورة
                        ${escapeHtml(
                            first.surah
                        )}

                        (
                        ${escapeHtml(
                            first.fromAyah || '1'
                        )}
                        )

                    </strong>

                </div>


                <div>

                    آخر إنجاز:

                    <strong>

                        سورة
                        ${escapeHtml(
                            last.surah
                        )}

                        (
                        ${escapeHtml(
                            last.toAyah || 'النهاية'
                        )}
                        )

                    </strong>

                </div>

            </div>


            <div class="achievement-value">

                ${recitations.length}

                <small>
                    جلسة تسميع
                </small>

            </div>

        </div>

    `;
}


// ============================================================
// التقرير التفصيلي
// ============================================================

function generateStudentDetailedReport(
    records
) {

    pdfTableBody.innerHTML =
        '';


    if (!records.length) {

        pdfTableBody.innerHTML = `

            <tr>

                <td colspan="7">

                    لا توجد سجلات مسجلة
                    خلال هذه الفترة.

                </td>

            </tr>

        `;

        return;
    }


    records.forEach(
        record => {

            const tr =
                document.createElement(
                    'tr'
                );


            tr.innerHTML =
                createRecordRow(
                    record
                );


            pdfTableBody.appendChild(
                tr
            );
        }
    );
}


// ============================================================
// إنشاء صف السجل
// ============================================================

function createRecordRow(
    record
) {

    const status =
        record.status || '-';


    const statusClass =
        getStatusClass(
            status
        );


    return `

        <td>

            ${formatDate(
                record.date
            )}

        </td>


        <td>

            <span
                class="status-badge ${statusClass}"
            >

                ${escapeHtml(
                    status
                )}

            </span>

        </td>


        <td>

            ${escapeHtml(
                record.surah ||
                '-'
            )}

        </td>


        <td>

            ${escapeHtml(
                record.fromAyah ||
                '-'
            )}

        </td>


        <td>

            ${escapeHtml(
                record.toAyah ||
                '-'
            )}

        </td>


        <td>

            ${escapeHtml(
                record.grade ||
                '-'
            )}

        </td>


        <td>

            <span class="points-badge">

                ${
                    Number(
                        record.pointsGiven
                    ) || 0
                }

            </span>

        </td>

    `;
}


// ============================================================
// نوع الحالة
// ============================================================

function getStatusClass(
    status
) {

    switch (status) {

        case 'حاضر':
            return 'status-present';


        case 'غائب':
            return 'status-absent';


        case 'إجازة':
            return 'status-leave';


        case 'مستأذن':
            return 'status-permission';


        case 'مراجعة':
            return 'status-review';


        default:
            return '';

    }
}


// ============================================================
// الملاحظات
// ============================================================

function updateNotes() {

    const notes =
        reportNotes.value.trim();


    pdfNotesText.textContent =
        notes ||
        'لا توجد ملاحظات أو توصيات إضافية.';
}


// ============================================================
// تنظيف التقرير
// ============================================================

function resetReport() {

    pdfStudentName.textContent =
        '-';


    pdfHalaqaName.textContent =
        '-';


    pdfMonth.textContent =
        '-';


    pdfReportPeriod.textContent =
        '-';


    pdfAttendCount.textContent =
        '0';


    pdfAbsentCount.textContent =
        '0';


    pdfRecitations.textContent =
        '0';


    pdfPoints.textContent =
        '0';


    pdfAttendanceRate.textContent =
        '0%';


    pdfAttendanceProgress.style.width =
        '0%';


    pdfAveragePoints.textContent =
        '0';


    pdfStudentCount.textContent =
        '0';


    pdfRecordsCount.textContent =
        '0';


    pdfPresentStatus.textContent =
        '0';


    pdfAbsentStatus.textContent =
        '0';


    pdfLeaveStatus.textContent =
        '0';


    pdfPermissionStatus.textContent =
        '0';


    pdfReviewStatus.textContent =
        '0';


    pdfSummaryText.innerHTML =
        '';


    pdfAchievement.innerHTML =
        '';


    pdfTableBody.innerHTML =
        '';


    studentSummarySection.style.display =
        'none';


    detailedSection.style.display =
        'none';


    achievementSection.style.display =
        'block';
}


// ============================================================
// الشهر
// ============================================================

function formatMonth(
    month
) {

    if (!month) {
        return '-';
    }


    const [
        year,
        monthNumber
    ] =
        month.split('-');


    const names = [

        'يناير',
        'فبراير',
        'مارس',
        'أبريل',
        'مايو',
        'يونيو',
        'يوليو',
        'أغسطس',
        'سبتمبر',
        'أكتوبر',
        'نوفمبر',
        'ديسمبر'

    ];


    return `${names[
        Number(monthNumber) - 1
    ] || monthNumber} ${year}`;
}


// ============================================================
// التاريخ
// ============================================================

function formatDate(
    dateValue
) {

    const date =
        timestampToDate(
            dateValue
        );


    if (!date) {
        return '-';
    }


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            '0'
        );


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            '0'
        );


    const year =
        date.getFullYear();


    return `${day}/${month}/${year}`;
}


// ============================================================
// حماية HTML
// ============================================================

function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return '';
    }


    return String(value)

        .replaceAll(
            '&',
            '&amp;'
        )

        .replaceAll(
            '<',
            '&lt;'
        )

        .replaceAll(
            '>',
            '&gt;'
        )

        .replaceAll(
            '"',
            '&quot;'
        )

        .replaceAll(
            "'",
            '&#039;'
        );
}


// ============================================================
// حالة المعاينة
// ============================================================

function setStatus(
    text,
    type
) {

    previewStatus.textContent =
        text;


    previewStatus.style.background =
        type === 'error'

            ? '#faeeee'

            : type === 'loading'

                ? '#f5ead0'

                : '#eaf4ef';


    previewStatus.style.color =
        type === 'error'

            ? '#b84545'

            : type === 'loading'

                ? '#86651e'

                : '#185443';
}


// ============================================================
// PDF
// ============================================================

async function downloadPDF() {

    const month =
        monthSelect.value;


    if (!month) {

        alert(
            'يرجى اختيار الشهر أولاً.'
        );

        return;
    }


    if (
        !studentSelect.value
    ) {

        alert(
            'يرجى اختيار الطالب أولاً.'
        );

        return;
    }


    const element =
        document.getElementById(
            'pdfContent'
        );


    if (!element) {

        alert(
            'تعذر العثور على محتوى التقرير.'
        );

        return;
    }


    const name =
        pdfStudentName.textContent
            .trim()
            .replace(
                /[^\u0600-\u06FFa-zA-Z0-9]+/g,
                '_'
            );


    const safeMonth =
        month.replace(
            '-',
            '_'
        );


    const filename =
        `تقرير_الطالب_${name}_${safeMonth}.pdf`;


    const originalText =
        generatePdfBtn.innerHTML;


    generatePdfBtn.innerHTML =
        '<span>⏳</span> جاري إنشاء التقرير...';


    generatePdfBtn.disabled =
        true;


    try {

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    350
                )
        );


        const options = {

            margin: [
                4,
                4,
                4,
                4
            ],


            filename,


            image: {

                type:
                    'jpeg',

                quality:
                    0.98

            },


            html2canvas: {

                scale:
                    2,

                useCORS:
                    true,

                allowTaint:
                    true,

                backgroundColor:
                    '#ffffff',

                logging:
                    false,

                scrollX:
                    0,

                scrollY:
                    0

            },


            jsPDF: {

                unit:
                    'mm',

                format:
                    'a4',

                orientation:
                    'portrait',

                compress:
                    true

            },


            pagebreak: {

                mode: [
                    'css',
                    'legacy'
                ],

                avoid: [

                    '.report-section',

                    '.status-section',

                    '.achievement-section',

                    '.notes-section',

                    'tr'

                ]

            }

        };


        await html2pdf()
            .set(options)
            .from(element)
            .save();


        setStatus(
            'تم استخراج التقرير',
            'success'
        );

    } catch (error) {

        console.error(
            'PDF Error:',
            error
        );


        alert(
            'حدث خطأ أثناء إنشاء ملف PDF.'
        );


        setStatus(
            'فشل استخراج PDF',
            'error'
        );

    } finally {

        generatePdfBtn.innerHTML =
            originalText;


        generatePdfBtn.disabled =
            false;
    }
}
