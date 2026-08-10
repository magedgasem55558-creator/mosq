import {
    db,
    auth,
    loadAllStudents,
    loadHalaqatList
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


// التحكم

const scopeSelect =
    $('scopeSelect');

const halaqaSelect =
    $('halaqaSelect');

const studentSelect =
    $('studentSelect');

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

const halaqaGroup =
    $('halaqaGroup');

const studentGroup =
    $('studentGroup');

const previewStatus =
    $('previewStatus');


// التقرير

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


// الإحصائيات

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


// الحالات

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


// الأقسام

const studentSummarySection =
    $('studentSummarySection');

const halaqaSummarySection =
    $('halaqaSummarySection');

const detailedSection =
    $('detailedSection');

const achievementSection =
    $('achievementSection');

const pdfSummaryText =
    $('pdfSummaryText');

const pdfAchievement =
    $('pdfAchievement');

const pdfHalaqaSummaryBody =
    $('pdfHalaqaSummaryBody');

const pdfTableBody =
    $('pdfTableBody');

const pdfNotesText =
    $('pdfNotesText');

const studentColumnHeader =
    $('studentColumnHeader');


// ============================================================
// التخزين المؤقت
// ============================================================

let studentsCache = [];

let halaqatCache = [];

let halaqatMap = {};

let currentReportData = null;

let updateTimer = null;


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

            studentSelect.innerHTML =
                '<option value="">⚠️ يرجى تسجيل الدخول أولاً</option>';

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

        const now =
            new Date();

        const currentMonth =
            `${now.getFullYear()}-${String(
                now.getMonth() + 1
            ).padStart(2, '0')}`;

        monthSelect.value =
            currentMonth;


        const [
            halaqat,
            students
        ] = await Promise.all([

            loadHalaqatList(),

            loadAllStudents()

        ]);


        halaqatCache =
            Array.isArray(halaqat)
                ? halaqat
                : [];


        halaqatMap = {};

        halaqatCache.forEach(
            halaqa => {

                halaqatMap[halaqa.id] =
                    halaqa.name ||
                    'حلقة بدون اسم';
            }
        );


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
                                halaqatMap[
                                    student.halaqaId
                                ] ||
                                'غير محدد'

                        })
                    )
                : [];


        populateHalaqat();

        populateStudents();

        setupEvents();

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
// الحلقات
// ============================================================

function populateHalaqat() {

    halaqaSelect.innerHTML =
        '<option value="">اختر الحلقة...</option>';

    halaqatCache
        .slice()
        .sort(
            (a, b) =>
                String(a.name || '')
                    .localeCompare(
                        String(b.name || ''),
                        'ar'
                    )
        )
        .forEach(
            halaqa => {

                const option =
                    document.createElement(
                        'option'
                    );

                option.value =
                    halaqa.id;

                option.textContent =
                    halaqa.name ||
                    'حلقة بدون اسم';

                halaqaSelect.appendChild(
                    option
                );
            }
        );
}


// ============================================================
// الطلاب
// ============================================================

function populateStudents() {

    studentSelect.innerHTML =
        '<option value="">اختر الطالب...</option>';

    studentsCache
        .slice()
        .sort(
            (a, b) =>
                String(a.name || '')
                    .localeCompare(
                        String(b.name || ''),
                        'ar'
                    )
        )
        .forEach(
            student => {

                const option =
                    document.createElement(
                        'option'
                    );

                option.value =
                    student.id;

                option.textContent =
                    `${student.name || 'طالب بدون اسم'} — ${student.halaqaName || 'غير محدد'}`;

                studentSelect.appendChild(
                    option
                );
            }
        );
}


// ============================================================
// الأحداث
// ============================================================

function setupEvents() {

    scopeSelect.addEventListener(
        'change',
        async () => {

            const scope =
                scopeSelect.value;

            if (scope === 'halaqa') {

                halaqaGroup.style.display =
                    'block';

                studentGroup.style.display =
                    'none';

            } else {

                halaqaGroup.style.display =
                    'none';

                studentGroup.style.display =
                    'block';
            }

            await updateReportPreview();
        }
    );


    halaqaSelect.addEventListener(
        'change',
        schedulePreview
    );

    studentSelect.addEventListener(
        'change',
        schedulePreview
    );

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
// تأخير التحديث حتى لا تتكرر الاستعلامات
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

    const scope =
        scopeSelect.value;

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

        if (scope === 'student') {

            await generateStudentReport(
                month,
                reportType
            );

        } else {

            await generateHalaqaReport(
                month,
                reportType
            );
        }


        updateNotes();


        currentReportData = {
            scope,
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


    if (!studentId) {

        pdfReportBadge.textContent =
            'تقرير أداء الطالب';

        pdfMainTitle.textContent =
            'تقرير الأداء والمتابعة';

        pdfStudentName.textContent =
            'يرجى اختيار طالب';

        studentSummarySection.style.display =
            'block';

        pdfSummaryText.innerHTML = `
            <strong>
                لم يتم اختيار طالب بعد.
            </strong>
            <br>
            اختر طالبًا من لوحة التحكم لعرض التقرير.
        `;

        return;
    }


    const student =
        studentsCache.find(
            item =>
                item.id === studentId
        );


    if (!student) {
        return;
    }


    const records =
        await fetchStudentRecordsForMonth(
            studentId,
            month
        );


    const stats =
        calculateStats(records);


    fillHeader(
        {
            badge:
                reportType === 'summary'
                    ? 'تقرير أداء مختصر'
                    : 'تقرير أداء تفصيلي',

            title:
                `تقرير أداء الطالب`,

            type:
                'تقرير طالب',

            name:
                student.name ||
                'طالب بدون اسم',

            halaqa:
                student.halaqaName ||
                'غير محدد',

            month
        }
    );


    fillStats(
        stats,
        1,
        records.length
    );


    studentSummarySection.style.display =
        reportType === 'summary'
            ? 'block'
            : 'none';

    halaqaSummarySection.style.display =
        'none';

    detailedSection.style.display =
        reportType === 'detailed'
            ? 'block'
            : 'none';

    achievementSection.style.display =
        'block';


    studentColumnHeader.style.display =
        'none';


    if (reportType === 'summary') {

        generateStudentSummary(
            records,
            stats
        );

    }


    if (reportType === 'detailed') {

        generateStudentDetailedReport(
            records
        );
    }


    generateAchievement(
        records
    );
}


// ============================================================
// تقرير الحلقة
// ============================================================

async function generateHalaqaReport(
    month,
    reportType
) {

    const halaqaId =
        halaqaSelect.value;


    pdfReportType.textContent =
        'تقرير الحلقة';


    pdfReportPeriod.textContent =
        `الفترة: ${formatMonth(month)}`;


    if (!halaqaId) {

        fillHeader({

            badge:
                'تقرير الحلقة',

            title:
                'تقرير أداء الحلقة',

            type:
                'تقرير حلقة',

            name:
                'يرجى اختيار الحلقة',

            halaqa:
                '-',

            month

        });

        return;
    }


    const halaqa =
        halaqatCache.find(
            item =>
                item.id === halaqaId
        );


    const halaqaName =
        halaqa?.name ||
        halaqatMap[halaqaId] ||
        'حلقة بدون اسم';


    /*
     * جلب سجلات الحلقة كلها مرة واحدة.
     * أفضل بكثير من عمل query لكل طالب.
     */

    const allRecords =
        await fetchHalaqaRecordsForMonth(
            halaqaId,
            month
        );


    const halaqaStudents =
        studentsCache.filter(
            student =>
                student.halaqaId === halaqaId
        );


    const studentData =
        halaqaStudents.map(
            student => {

                const records =
                    allRecords.filter(
                        record =>
                            record.studentId ===
                            student.id
                    );

                return {

                    student,

                    records,

                    stats:
                        calculateStats(
                            records
                        )
                };
            }
        );


    const totalStats =
        combineStats(
            studentData.map(
                item =>
                    item.stats
            )
        );


    fillHeader({

        badge:
            reportType === 'summary'
                ? 'تقرير الحلقة - مختصر'
                : 'تقرير الحلقة - تفصيلي',

        title:
            'تقرير أداء الحلقة',

        type:
            'تقرير الحلقة كاملة',

        name:
            halaqaName,

        halaqa:
            halaqaName,

        month

    });


    fillStats(
        totalStats,
        halaqaStudents.length,
        allRecords.length
    );


    studentSummarySection.style.display =
        'none';


    halaqaSummarySection.style.display =
        reportType === 'summary'
            ? 'block'
            : 'none';


    detailedSection.style.display =
        reportType === 'detailed'
            ? 'block'
            : 'none';


    achievementSection.style.display =
        'block';


    studentColumnHeader.style.display =
        reportType === 'detailed'
            ? 'table-cell'
            : 'none';


    if (reportType === 'summary') {

        generateHalaqaSummaryReport(
            studentData
        );

    }


    if (reportType === 'detailed') {

        generateHalaqaDetailedReport(
            studentData
        );
    }


    generateHalaqaAchievement(
        studentData
    );
}


// ============================================================
// جلب سجلات الطالب
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
// جلب سجلات الحلقة
// ============================================================

async function fetchHalaqaRecordsForMonth(
    halaqaId,
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
                    'halaqaId',
                    '==',
                    halaqaId
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
            'Halaqa Records Error:',
            error
        );

        return [];
    }
}


// ============================================================
// هل السجل في الشهر؟
 // ============================================================

function isRecordInMonth(
    date,
    month
) {

    return String(
        date || ''
    ).startsWith(
        month
    );
}


// ============================================================
// ترتيب السجلات
// ============================================================

function sortRecords(
    records
) {

    return records.sort(
        (a, b) =>
            String(a.date || '')
                .localeCompare(
                    String(b.date || '')
                )
    );
}


// ============================================================
// الإحصائيات
// ============================================================

function calculateStats(
    records
) {

    const stats = {

        total: records.length,

        attendance: 0,

        absence: 0,

        leave: 0,

        permission: 0,

        review: 0,

        recitations: 0,

        points: 0,

        averagePoints: 0,

        attendanceRate: 0
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

                default:

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


    /*
     * نسبة الحضور الحقيقية:
     *
     * الحضور / كل سجلات الحضور والغياب
     */

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
// دمج إحصائيات الحلقة
// ============================================================

function combineStats(
    statsList
) {

    const result = {

        total: 0,

        attendance: 0,

        absence: 0,

        leave: 0,

        permission: 0,

        review: 0,

        recitations: 0,

        points: 0,

        averagePoints: 0,

        attendanceRate: 0
    };


    statsList.forEach(
        stats => {

            result.total +=
                stats.total;

            result.attendance +=
                stats.attendance;

            result.absence +=
                stats.absence;

            result.leave +=
                stats.leave;

            result.permission +=
                stats.permission;

            result.review +=
                stats.review;

            result.recitations +=
                stats.recitations;

            result.points +=
                stats.points;
        }
    );


    const base =
        result.attendance +
        result.absence;


    result.attendanceRate =
        base > 0
            ? Math.round(
                (
                    result.attendance /
                    base
                ) * 100
            )
            : 0;


    result.averagePoints =
        result.total > 0
            ? Number(
                (
                    result.points /
                    result.total
                ).toFixed(1)
            )
            : 0;


    return result;
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
        formatMonth(data.month);

    pdfReportPeriod.textContent =
        `الفترة: ${formatMonth(data.month)}`;
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
            لم يتم تسجيل أي حضور أو متابعة لهذا الطالب خلال الشهر المحدد.
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
            <strong>${stats.total}</strong>
            سجلًا خلال الفترة، منها
            <strong>${stats.attendance}</strong>
            حضورًا و
            <strong>${stats.absence}</strong>
            غيابًا، مع نسبة حضور بلغت
            <strong>${stats.attendanceRate}%</strong>.
            
            وقد بلغ إجمالي النقاط
            <strong>${stats.points}</strong>
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
                            ? `سورة ${escapeHtml(first.surah)} — آية ${escapeHtml(first.fromAyah || '1')}`
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
                            ? `سورة ${escapeHtml(last.surah)} — آية ${escapeHtml(last.toAyah || 'النهاية')}`
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
// إنجاز الطالب
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
                        سورة ${escapeHtml(first.surah)}
                        (${escapeHtml(first.fromAyah || '1')})
                    </strong>
                </div>

                <div>
                    آخر إنجاز:
                    <strong>
                        سورة ${escapeHtml(last.surah)}
                        (${escapeHtml(last.toAyah || 'النهاية')})
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
// ملخص الحلقة
// ============================================================

function generateHalaqaSummaryReport(
    studentData
) {

    pdfHalaqaSummaryBody.innerHTML =
        '';


    if (!studentData.length) {

        pdfHalaqaSummaryBody.innerHTML = `

            <tr>

                <td colspan="8">
                    لا يوجد طلاب نشطون في هذه الحلقة.
                </td>

            </tr>
        `;

        return;
    }


    const sorted =
        studentData
            .slice()
            .sort(
                (a, b) =>
                    b.stats.points -
                    a.stats.points
            );


    sorted.forEach(
        (item, index) => {

            const stats =
                item.stats;

            const student =
                item.student;


            const level =
                getAchievementLevel(
                    stats
                );


            const tr =
                document.createElement(
                    'tr'
                );


            tr.innerHTML = `

                <td>
                    ${index + 1}
                </td>

                <td style="font-weight:700;">
                    ${escapeHtml(
                        student.name || '-'
                    )}
                </td>

                <td>
                    ${stats.attendance}
                </td>

                <td>
                    ${stats.absence}
                </td>

                <td>
                    ${stats.recitations}
                </td>

                <td>
                    <span class="points-badge">
                        ${stats.points}
                    </span>
                </td>

                <td>
                    ${stats.attendanceRate}%
                </td>

                <td>
                    ${escapeHtml(level)}
                </td>
            `;


            pdfHalaqaSummaryBody.appendChild(
                tr
            );
        }
    );


    generateHalaqaAchievement(
        sorted
    );
}


// ============================================================
// إنجاز الحلقة
// ============================================================

function generateHalaqaAchievement(
    studentData
) {

    if (!studentData.length) {

        pdfAchievement.textContent =
            'لا توجد بيانات كافية.';

        return;
    }


    const topStudent =
        studentData
            .slice()
            .sort(
                (a, b) =>
                    b.stats.points -
                    a.stats.points
            )[0];


    const totalRecitations =
        studentData.reduce(
            (sum, item) =>
                sum +
                item.stats.recitations,
            0
        );


    pdfAchievement.innerHTML = `

        <div class="achievement-main">

            <div>

                <div class="achievement-title">
                    أبرز مؤشرات الحلقة
                </div>

                <div style="margin-top:6px;">
                    أعلى نقاط:
                    <strong>
                        ${escapeHtml(
                            topStudent.student.name ||
                            '-'
                        )}
                    </strong>
                    —
                    ${topStudent.stats.points}
                    نقطة
                </div>

                <div>
                    إجمالي جلسات التسميع:
                    <strong>
                        ${totalRecitations}
                    </strong>
                </div>

            </div>


            <div class="achievement-value">

                ${studentData.length}

                <small>
                    طالب نشط
                </small>

            </div>

        </div>
    `;
}


// ============================================================
// التقرير التفصيلي للطالب
// ============================================================

function generateStudentDetailedReport(
    records
) {

    pdfTableBody.innerHTML =
        '';


    if (!records.length) {

        pdfTableBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                >
                    لا توجد سجلات مسجلة خلال هذه الفترة.
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
                    record,
                    false
                );


            pdfTableBody.appendChild(
                tr
            );
        }
    );
}


// ============================================================
// التقرير التفصيلي للحلقة
// ============================================================

function generateHalaqaDetailedReport(
    studentData
) {

    pdfTableBody.innerHTML =
        '';


    let count = 0;


    studentData.forEach(
        item => {

            item.records.forEach(
                record => {

                    count++;


                    const tr =
                        document.createElement(
                            'tr'
                        );


                    tr.innerHTML =
                        createRecordRow(
                            record,
                            true,
                            item.student.name
                        );


                    pdfTableBody.appendChild(
                        tr
                    );
                }
            );
        }
    );


    if (!count) {

        pdfTableBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                >
                    لا توجد سجلات مسجلة لهذه الحلقة خلال الفترة المحددة.
                </td>

            </tr>
        `;
    }
}


// ============================================================
// إنشاء صف سجل
// ============================================================

function createRecordRow(
    record,
    showStudent,
    studentName = ''
) {

    const status =
        record.status || '-';


    const statusClass =
        getStatusClass(
            status
        );


    return `

        <td
            style="
                display:${showStudent
                    ? 'table-cell'
                    : 'none'};
                font-weight:700;
            "
        >
            ${escapeHtml(
                studentName ||
                record.studentName ||
                '-'
            )}
        </td>


        <td>
            ${formatDate(
                record.date
            )}
        </td>


        <td>

            <span
                class="status-badge ${statusClass}"
            >
                ${escapeHtml(status)}
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
                ${Number(
                    record.pointsGiven
                ) || 0}
            </span>
        </td>
    `;
}


// ============================================================
// مستوى الإنجاز
// ============================================================

function getAchievementLevel(
    stats
) {

    if (
        stats.attendanceRate >= 90 &&
        stats.points >= 100
    ) {

        return 'متميز';
    }


    if (
        stats.attendanceRate >= 80
    ) {

        return 'جيد جدًا';
    }


    if (
        stats.attendanceRate >= 60
    ) {

        return 'جيد';
    }


    return 'يحتاج متابعة';
}


// ============================================================
// نوع حالة الحضور
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

    pdfHalaqaSummaryBody.innerHTML =
        '';

    pdfTableBody.innerHTML =
        '';


    studentSummarySection.style.display =
        'none';

    halaqaSummarySection.style.display =
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
    date
) {

    if (!date) {
        return '-';
    }


    const parts =
        String(date).split('-');


    if (parts.length !== 3) {
        return date;
    }


    return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

    const scope =
        scopeSelect.value;

    const month =
        monthSelect.value;


    if (!month) {

        alert(
            'يرجى اختيار الشهر أولاً.'
        );

        return;
    }


    if (
        scope === 'student' &&
        !studentSelect.value
    ) {

        alert(
            'يرجى اختيار الطالب أولاً.'
        );

        return;
    }


    if (
        scope === 'halaqa' &&
        !halaqaSelect.value
    ) {

        alert(
            'يرجى اختيار الحلقة أولاً.'
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
        scope === 'halaqa'

            ? `تقرير_الحلقة_${name}_${safeMonth}.pdf`

            : `تقرير_${name}_${safeMonth}.pdf`;


    const originalText =
        generatePdfBtn.innerHTML;


    generatePdfBtn.innerHTML =
        '<span>⏳</span> جاري إنشاء التقرير...';

    generatePdfBtn.disabled =
        true;


    try {

        /*
         * انتظار بسيط حتى تكتمل
         * إعادة رسم الجداول.
         */

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
