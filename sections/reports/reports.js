// ============================================================
// 📊 التقارير - حلقات القرآن
// 👤 تقرير طالب
// 📖 تقرير حلقة كاملة
// ⭐ حفظ + إتقان + تجويد + مراجعة
// 🟠 مستأذن
// 🔵 إجازة
// ============================================================

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

const reportScope =
    document.getElementById('reportScope');

const halaqaSelect =
    document.getElementById('halaqaSelect');

const studentSelect =
    document.getElementById('studentSelect');

const halaqaGroup =
    document.getElementById('halaqaGroup');

const studentGroup =
    document.getElementById('studentGroup');

const monthSelect =
    document.getElementById('monthSelect');

const reportTypeSelect =
    document.getElementById('reportType');

const reportNotes =
    document.getElementById('reportNotes');

const generatePdfBtn =
    document.getElementById('generatePdfBtn');


// ============================================================
// عناصر التقرير
// ============================================================

const pdfReportBadge =
    document.getElementById('pdfReportBadge');

const pdfStudentName =
    document.getElementById('pdfStudentName');

const pdfHalaqaName =
    document.getElementById('pdfHalaqaName');

const pdfMonth =
    document.getElementById('pdfMonth');

const pdfHijriMonth =
    document.getElementById('pdfHijriMonth');

const pdfPoints =
    document.getElementById('pdfPoints');

const pdfCurrentPoints =
    document.getElementById('pdfCurrentPoints');

const pdfPresentCount =
    document.getElementById('pdfPresentCount');

const pdfAbsentCount =
    document.getElementById('pdfAbsentCount');

const pdfLeaveCount =
    document.getElementById('pdfLeaveCount');

const pdfPermissionCount =
    document.getElementById('pdfPermissionCount');

const pdfReviewCount =
    document.getElementById('pdfReviewCount');

const pdfTotalCount =
    document.getElementById('pdfTotalCount');

const summarySection =
    document.getElementById('summarySection');

const pdfSummaryText =
    document.getElementById('pdfSummaryText');

const studentDetailedSection =
    document.getElementById('studentDetailedSection');

const pdfTableBody =
    document.getElementById('pdfTableBody');

const halaqaSummarySection =
    document.getElementById('halaqaSummarySection');

const halaqaSummaryBody =
    document.getElementById('halaqaSummaryBody');

const halaqaDetailedSection =
    document.getElementById('halaqaDetailedSection');

const halaqaDetailedBody =
    document.getElementById('halaqaDetailedBody');

const pdfNotesText =
    document.getElementById('pdfNotesText');


// ============================================================
// المتغيرات
// ============================================================

let studentsCache = [];

let halaqatCache = [];

let halaqatMap = {};

let currentReportData = null;

let previewRequestId = 0;


// ============================================================
// الحالات المعتمدة
// ============================================================

const STATUS_CONFIG = {

    'حاضر': {
        icon: '✅',
        className: 'status-present',
        label: 'حاضر'
    },

    'غائب': {
        icon: '❌',
        className: 'status-absent',
        label: 'غائب'
    },

    'إجازة': {
        icon: '🔵',
        className: 'status-leave',
        label: 'إجازة'
    },

    'مستأذن': {
        icon: '🟠',
        className: 'status-permission',
        label: 'مستأذن'
    },

    'مراجعة': {
        icon: '🔷',
        className: 'status-review',
        label: 'مراجعة'
    }

};


// ============================================================
// التاريخ الحالي
// ============================================================

function getCurrentMonth() {

    const now =
        new Date();

    return (
        `${now.getFullYear()}-` +
        `${String(
            now.getMonth() + 1
        ).padStart(2, '0')}`
    );

}


// ============================================================
// التاريخ الهجري
// ============================================================

function gregorianToHijri(
    gregorianDate
) {

    const gDate =
        new Date(
            gregorianDate + '-01'
        );

    const jd =
        Math.floor(
            (
                gDate.getTime() /
                86400000
            ) +
            2440587.5
        );

    const l =
        jd -
        1948440 +
        10632;

    const n =
        Math.floor(
            (l - 1) / 10631
        );

    const l2 =
        l -
        10631 * n +
        354;

    const j =
        Math.floor(
            (10985 - l2) / 5316
        ) *
        Math.floor(
            (50 * l2) / 17719
        ) +
        Math.floor(
            l2 / 5670
        ) *
        Math.floor(
            (43 * l2) / 15238
        );

    const l3 =
        l2 -
        Math.floor(
            (30 - j) / 15
        ) *
        Math.floor(
            (17719 * j) / 50
        ) -
        Math.floor(
            j / 16
        ) *
        Math.floor(
            (15238 * j) / 43
        ) +
        29;

    const month =
        Math.floor(
            (24 * l3) / 709
        );

    const year =
        Math.floor(
            (30 * n) +
            j -
            30
        ) + 1;

    const hijriMonths = [

        'محرم',
        'صفر',
        'ربيع الأول',
        'ربيع الآخر',
        'جمادى الأولى',
        'جمادى الآخرة',
        'رجب',
        'شعبان',
        'رمضان',
        'شوال',
        'ذو القعدة',
        'ذو الحجة'

    ];

    if (
        month >= 1 &&
        month <= 12
    ) {

        return (
            `${hijriMonths[month - 1]} ` +
            `${year} هـ`
        );

    }

    return `${year} هـ`;

}


// ============================================================
// تنظيف النص
// ============================================================

function cleanText(
    value
) {

    return String(
        value ?? ''
    ).trim();

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
// اسم الحلقة
// ============================================================

function getHalaqaName(
    student
) {

    if (!student) {
        return 'غير محدد';
    }

    return (
        student.halaqaName ||
        halaqatMap[
            student.halaqaId
        ] ||
        'غير محدد'
    );

}


// ============================================================
// الحصول على بيانات الطالب
// ============================================================

function getStudentById(
    studentId
) {

    return studentsCache.find(
        student =>
            student.id === studentId
    ) || null;

}


// ============================================================
// الحصول على الحلقة
// ============================================================

function getHalaqaById(
    halaqaId
) {

    return halaqatCache.find(
        halaqa =>
            halaqa.id === halaqaId
    ) || null;

}


// ============================================================
// التحقق من الدخول
// ============================================================

onAuthStateChanged(
    auth,
    user => {

        if (user) {

            init();

        } else {

            console.warn(
                '⚠️ لا يوجد مستخدم مسجل الدخول.'
            );

            if (studentSelect) {

                studentSelect.innerHTML =
                    '<option value="">⚠️ يرجى تسجيل الدخول أولاً</option>';

            }

            if (halaqaSelect) {

                halaqaSelect.innerHTML =
                    '<option value="">⚠️ يرجى تسجيل الدخول أولاً</option>';

            }

        }

    }
);


// ============================================================
// التهيئة
// ============================================================

async function init() {

    try {

        const currentMonth =
            getCurrentMonth();

        if (monthSelect) {

            monthSelect.value =
                currentMonth;

        }


        if (studentSelect) {

            studentSelect.innerHTML =
                '<option value="">⏳ جاري تحميل الطلاب...</option>';

        }


        if (halaqaSelect) {

            halaqaSelect.innerHTML =
                '<option value="">⏳ جاري تحميل الحلقات...</option>';

        }


        const [
            halaqat,
            students
        ] = await Promise.all([

            loadHalaqatList()
                .catch(error => {

                    console.error(
                        'خطأ تحميل الحلقات:',
                        error
                    );

                    return [];

                }),

            loadAllStudents()
                .catch(error => {

                    console.error(
                        'خطأ تحميل الطلاب:',
                        error
                    );

                    return [];

                })

        ]);


        halaqatCache =
            Array.isArray(halaqat)
                ? halaqat
                : [];


        studentsCache =
            Array.isArray(students)
                ? students
                : [];


        halaqatMap = {};


        halaqatCache.forEach(
            halaqa => {

                halaqatMap[
                    halaqa.id
                ] =
                    halaqa.name ||
                    'حلقة بدون اسم';

            }
        );


        studentsCache =
            studentsCache.map(
                student => ({

                    ...student,

                    halaqaName:
                        student.halaqaName ||
                        halaqatMap[
                            student.halaqaId
                        ] ||
                        'غير محدد'

                })
            );


        renderHalaqat();

        renderStudents();

        setupEventListeners();

        updateScopeUI();

        await updateReportPreview();


    } catch (error) {

        console.error(
            '❌ خطأ في تهيئة التقارير:',
            error
        );

        showErrorState();

    }

}


// ============================================================
// عرض الحلقات
// ============================================================

function renderHalaqat() {

    if (!halaqaSelect) {
        return;
    }


    halaqaSelect.innerHTML =
        '<option value="">-- اختر الحلقة --</option>';


    halaqatCache
        .slice()
        .sort(
            (a, b) =>
                String(
                    a.name || ''
                ).localeCompare(
                    String(
                        b.name || ''
                    ),
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
// عرض الطلاب
// ============================================================

function renderStudents() {

    if (!studentSelect) {
        return;
    }


    studentSelect.innerHTML =
        '<option value="">-- اختر الطالب --</option>';


    const students =
        studentsCache
            .slice()
            .sort(
                (a, b) =>
                    String(
                        a.name || ''
                    ).localeCompare(
                        String(
                            b.name || ''
                        ),
                        'ar'
                    )
            );


    students.forEach(
        student => {

            const option =
                document.createElement(
                    'option'
                );

            option.value =
                student.id;

            option.textContent =
                `${student.name || 'طالب بدون اسم'} ` +
                `(${getHalaqaName(student)})`;

            studentSelect.appendChild(
                option
            );

        }
    );

}


// ============================================================
// واجهة نطاق التقرير
// ============================================================

function updateScopeUI() {

    const scope =
        reportScope?.value ||
        'student';


    if (scope === 'student') {

        if (studentGroup) {

            studentGroup.style.display =
                'block';

        }

        if (halaqaGroup) {

            halaqaGroup.style.display =
                'block';

        }

        if (reportTypeSelect) {

            reportTypeSelect.innerHTML = `

                <option value="summary">
                    📊 تقرير مختصر للطالب
                </option>

                <option value="detailed">
                    📋 تقرير تفصيلي للطالب
                </option>

            `;

        }


        if (pdfReportBadge) {

            pdfReportBadge.textContent =
                'تقرير أداء الطالب';

        }

    } else {

        if (studentGroup) {

            studentGroup.style.display =
                'none';

        }

        if (halaqaGroup) {

            halaqaGroup.style.display =
                'block';

        }

        if (reportTypeSelect) {

            reportTypeSelect.innerHTML = `

                <option value="summary">
                    📊 ملخص الحلقة والطلاب
                </option>

                <option value="detailed">
                    📋 تقرير تفصيلي للحلقة
                </option>

            `;

        }


        if (pdfReportBadge) {

            pdfReportBadge.textContent =
                'تقرير الحلقة كاملة';

        }

    }

}


// ============================================================
// المستمعون
// ============================================================

function setupEventListeners() {

    reportScope?.addEventListener(
        'change',
        async () => {

            updateScopeUI();

            clearPreview();

            await updateReportPreview();

        }
    );


    halaqaSelect?.addEventListener(
        'change',
        async () => {

            if (
                reportScope?.value ===
                'student'
            ) {

                filterStudentsByHalaqa();

            }

            await updateReportPreview();

        }
    );


    studentSelect?.addEventListener(
        'change',
        updateReportPreview
    );


    monthSelect?.addEventListener(
        'change',
        updateReportPreview
    );


    reportTypeSelect?.addEventListener(
        'change',
        updateReportPreview
    );


    reportNotes?.addEventListener(
        'input',
        () => {

            if (pdfNotesText) {

                pdfNotesText.textContent =
                    cleanText(
                        reportNotes.value
                    ) ||
                    'لا توجد ملاحظات.';

            }

        }
    );


    generatePdfBtn?.addEventListener(
        'click',
        downloadPDF
    );

}


// ============================================================
// فلترة الطلاب حسب الحلقة
// ============================================================

function filterStudentsByHalaqa() {

    if (!studentSelect) {
        return;
    }


    const halaqaId =
        halaqaSelect?.value;


    studentSelect.innerHTML =
        '<option value="">-- اختر الطالب --</option>';


    if (!halaqaId) {

        renderStudents();

        return;

    }


    studentsCache
        .filter(
            student =>
                student.halaqaId ===
                halaqaId
        )
        .sort(
            (a, b) =>
                String(
                    a.name || ''
                ).localeCompare(
                    String(
                        b.name || ''
                    ),
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
                    student.name ||
                    'طالب بدون اسم';

                studentSelect.appendChild(
                    option
                );

            }
        );

}


// ============================================================
// تحديث المعاينة
// ============================================================

async function updateReportPreview() {

    const requestId =
        ++previewRequestId;


    if (!monthSelect?.value) {
        return;
    }


    const scope =
        reportScope?.value ||
        'student';

    const month =
        monthSelect.value;


    showLoadingPreview();


    try {

        if (
            scope === 'student'
        ) {

            const studentId =
                studentSelect?.value;

            const halaqaId =
                halaqaSelect?.value;


            if (!studentId) {

                clearPreview();

                return;

            }


            const student =
                getStudentById(
                    studentId
                );


            if (!student) {

                clearPreview();

                return;

            }


            const effectiveHalaqaId =
                halaqaId ||
                student.halaqaId;


            const records =
                await fetchStudentRecordsForMonth(
                    studentId,
                    month
                );


            if (
                requestId !==
                previewRequestId
            ) {

                return;

            }


            currentReportData = {

                scope: 'student',

                student,

                halaqa:
                    getHalaqaById(
                        effectiveHalaqaId
                    ),

                records,

                month

            };


            renderStudentReport(
                currentReportData
            );


        } else {

            const halaqaId =
                halaqaSelect?.value;


            if (!halaqaId) {

                clearPreview();

                return;

            }


            const halaqa =
                getHalaqaById(
                    halaqaId
                );


            if (!halaqa) {

                clearPreview();

                return;

            }


            const records =
                await fetchHalaqaRecordsForMonth(
                    halaqaId,
                    month
                );


            if (
                requestId !==
                previewRequestId
            ) {

                return;

            }


            const students =
                studentsCache
                    .filter(
                        student =>
                            student.halaqaId ===
                            halaqaId
                    )
                    .sort(
                        (a, b) =>
                            String(
                                a.name || ''
                            ).localeCompare(
                                String(
                                    b.name || ''
                                ),
                                'ar'
                            )
                    );


            currentReportData = {

                scope: 'halaqa',

                halaqa,

                students,

                records,

                month

            };


            renderHalaqaReport(
                currentReportData
            );

        }


    } catch (error) {

        console.error(
            'Preview Error:',
            error
        );

        showMessage(
            '❌ تعذر إنشاء المعاينة.\n\n' +
            error.message
        );

    }

}


// ============================================================
// جلب سجلات طالب
// ============================================================

async function fetchStudentRecordsForMonth(
    studentId,
    monthStr
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
            recordDoc => {

                const data =
                    recordDoc.data();


                if (
                    data.date &&
                    String(
                        data.date
                    ).startsWith(
                        monthStr
                    )
                ) {

                    records.push({

                        id:
                            recordDoc.id,

                        ...data

                    });

                }

            }
        );


        records.sort(
            sortRecords
        );


        return records;


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
    monthStr
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
            recordDoc => {

                const data =
                    recordDoc.data();


                if (
                    data.date &&
                    String(
                        data.date
                    ).startsWith(
                        monthStr
                    )
                ) {

                    records.push({

                        id:
                            recordDoc.id,

                        ...data

                    });

                }

            }
        );


        records.sort(
            sortRecords
        );


        return records;


    } catch (error) {

        console.error(
            'Halaqa Records Error:',
            error
        );

        return [];

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
        dateA !==
        dateB
    ) {

        return dateA.localeCompare(
            dateB
        );

    }


    return String(
        a.studentName || ''
    ).localeCompare(
        String(
            b.studentName || ''
        ),
        'ar'
    );

}


// ============================================================
// إحصائيات الحالات
// ============================================================

function calculateStats(
    records
) {

    const stats = {

        حاضر: 0,

        غائب: 0,

        إجازة: 0,

        مستأذن: 0,

        مراجعة: 0,

        total: 0,

        points: 0

    };


    records.forEach(
        record => {

            const status =
                record.status ||
                'غائب';


            if (
                Object.prototype.hasOwnProperty.call(
                    stats,
                    status
                )
            ) {

                stats[status]++;

            }


            stats.total++;


            stats.points +=
                Number(
                    record.pointsGiven ||
                    0
                );

        }
    );


    return stats;

}


// ============================================================
// عرض إحصائيات التقرير
// ============================================================

function renderStats(
    stats
) {

    if (pdfPresentCount) {

        pdfPresentCount.textContent =
            stats.حاضر;

    }


    if (pdfAbsentCount) {

        pdfAbsentCount.textContent =
            stats.غائب;

    }


    if (pdfLeaveCount) {

        pdfLeaveCount.textContent =
            stats.إجازة;

    }


    if (pdfPermissionCount) {

        pdfPermissionCount.textContent =
            stats.مستأذن;

    }


    if (pdfReviewCount) {

        pdfReviewCount.textContent =
            stats.مراجعة;

    }


    if (pdfTotalCount) {

        pdfTotalCount.textContent =
            stats.total;

    }


    if (pdfPoints) {

        pdfPoints.textContent =
            stats.points;

    }

}


// ============================================================
// تقرير الطالب
// ============================================================

function renderStudentReport(
    data
) {

    const {
        student,
        halaqa,
        records,
        month
    } = data;


    const stats =
        calculateStats(
            records
        );


    if (pdfStudentName) {

        pdfStudentName.textContent =
            student.name ||
            'طالب بدون اسم';

    }


    if (pdfHalaqaName) {

        pdfHalaqaName.textContent =
            getHalaqaName(student);

    }


    if (pdfMonth) {

        pdfMonth.textContent =
            month;

    }


    if (pdfHijriMonth) {

        pdfHijriMonth.textContent =
            gregorianToHijri(
                month
            );

    }


    if (pdfCurrentPoints) {

        pdfCurrentPoints.textContent =
            Number(
                student.totalPoints ||
                0
            );

    }


    renderStats(
        stats
    );


    if (pdfReportBadge) {

        pdfReportBadge.textContent =
            reportTypeSelect?.value ===
            'detailed'
                ? 'تقرير أداء تفصيلي للطالب'
                : 'تقرير أداء مختصر للطالب';

    }


    if (reportNotes && pdfNotesText) {

        pdfNotesText.textContent =
            cleanText(
                reportNotes.value
            ) ||
            'لا توجد ملاحظات.';

    }


    const reportType =
        reportTypeSelect?.value ||
        'summary';


    hideAllReportSections();


    if (
        reportType ===
        'summary'
    ) {

        summarySection.style.display =
            'block';

        generateStudentSummary(
            records
        );

    } else {

        studentDetailedSection.style.display =
            'block';

        generateStudentDetailed(
            records
        );

    }

}


// ============================================================
// ملخص الطالب
// ============================================================

function generateStudentSummary(
    records
) {

    if (!pdfSummaryText) {
        return;
    }


    const stats =
        calculateStats(
            records
        );


    const recitationRecords =
        records.filter(
            record =>
                record.status ===
                'حاضر' &&
                cleanText(
                    record.surah
                ) &&
                record.surah !==
                'حاضر'
        );


    let recitationText =
        'لا توجد سجلات تسميع محددة لهذا الشهر.';


    if (
        recitationRecords.length
    ) {

        const first =
            recitationRecords[0];

        const last =
            recitationRecords[
                recitationRecords.length - 1
            ];


        const firstSurah =
            cleanText(
                first.surah
            );

        const lastSurah =
            cleanText(
                last.surah
            );


        recitationText = `

            <div class="summary-line">

                <span>
                    📖 نطاق التسميع:
                </span>

                <strong>
                    من سورة
                    ${escapeHtml(firstSurah)}
                    -
                    آية
                    ${escapeHtml(
                        first.fromAyah || '1'
                    )}
                </strong>

            </div>

            <div class="summary-line">

                <span>
                    📖 آخر رصد:
                </span>

                <strong>
                    سورة
                    ${escapeHtml(lastSurah)}
                    -
                    حتى آية
                    ${escapeHtml(
                        last.toAyah || 'النهاية'
                    )}
                </strong>

            </div>

        `;

    }


    pdfSummaryText.innerHTML = `

        <div class="summary-grid">

            <div class="summary-mini">

                <span>
                    📋 إجمالي الرصد
                </span>

                <strong>
                    ${stats.total}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    ✅ أيام الحضور
                </span>

                <strong>
                    ${stats.حاضر}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    ❌ الغياب
                </span>

                <strong>
                    ${stats.غائب}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    🔵 الإجازة
                </span>

                <strong>
                    ${stats.إجازة}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    🟠 الاستئذان
                </span>

                <strong>
                    ${stats.مستأذن}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    🔷 المراجعة
                </span>

                <strong>
                    ${stats.مراجعة}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    ⭐ نقاط الشهر
                </span>

                <strong>
                    ${stats.points}
                </strong>

            </div>

        </div>


        <div class="summary-recitation">

            ${recitationText}

        </div>

    `;

}


// ============================================================
// تفاصيل الطالب
// ============================================================

function generateStudentDetailed(
    records
) {

    if (!pdfTableBody) {
        return;
    }


    pdfTableBody.innerHTML = '';


    if (!records.length) {

        pdfTableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-cell"
                >

                    لا توجد سجلات مسجلة لهذا الشهر.

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


            const status =
                getStatusHtml(
                    record.status
                );


            const isPresent =
                record.status ===
                'حاضر';


            tr.innerHTML = `

                <td>
                    ${escapeHtml(
                        record.date || '-'
                    )}
                </td>

                <td>
                    ${status}
                </td>

                <td>
                    ${escapeHtml(
                        isPresent
                            ? (
                                record.surah ||
                                '-'
                            )
                            : '-'
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        isPresent
                            ? (
                                record.fromAyah ||
                                '-'
                            )
                            : '-'
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        isPresent
                            ? (
                                record.toAyah ||
                                '-'
                            )
                            : '-'
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        record.grade ||
                        '-'
                    )}
                </td>

                <td class="points-cell">
                    ${Number(
                        record.pointsGiven ||
                        0
                    )}
                </td>

            `;


            pdfTableBody.appendChild(
                tr
            );

        }
    );

}


// ============================================================
// تقرير الحلقة
// ============================================================

function renderHalaqaReport(
    data
) {

    const {
        halaqa,
        students,
        records,
        month
    } = data;


    const stats =
        calculateStats(
            records
        );


    if (pdfStudentName) {

        pdfStudentName.textContent =
            'جميع طلاب الحلقة';

    }


    if (pdfHalaqaName) {

        pdfHalaqaName.textContent =
            halaqa.name ||
            'حلقة بدون اسم';

    }


    if (pdfMonth) {

        pdfMonth.textContent =
            month;

    }


    if (pdfHijriMonth) {

        pdfHijriMonth.textContent =
            gregorianToHijri(
                month
            );

    }


    if (pdfCurrentPoints) {

        pdfCurrentPoints.textContent =
            '-';

    }


    renderStats(
        stats
    );


    if (pdfReportBadge) {

        pdfReportBadge.textContent =
            reportTypeSelect?.value ===
            'detailed'
                ? 'تقرير تفصيلي للحلقة كاملة'
                : 'تقرير الحلقة كاملة';

    }


    if (reportNotes && pdfNotesText) {

        pdfNotesText.textContent =
            cleanText(
                reportNotes.value
            ) ||
            'لا توجد ملاحظات.';

    }


    hideAllReportSections();


    const reportType =
        reportTypeSelect?.value ||
        'summary';


    if (
        reportType ===
        'summary'
    ) {

        halaqaSummarySection.style.display =
            'block';

        generateHalaqaSummary(
            students,
            records
        );

        generateHalaqaSummaryText(
            students,
            records,
            stats
        );

    } else {

        halaqaDetailedSection.style.display =
            'block';

        generateHalaqaDetailed(
            records
        );

    }

}


// ============================================================
// ملخص الحلقة
// ============================================================

function generateHalaqaSummary(
    students,
    records
) {

    if (!halaqaSummaryBody) {
        return;
    }


    halaqaSummaryBody.innerHTML = '';


    if (!students.length) {

        halaqaSummaryBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-cell"
                >

                    لا يوجد طلاب مسجلون في هذه الحلقة.

                </td>

            </tr>

        `;

        return;

    }


    const studentRecordsMap =
        new Map();


    records.forEach(
        record => {

            const studentId =
                record.studentId;


            if (
                !studentRecordsMap.has(
                    studentId
                )
            ) {

                studentRecordsMap.set(
                    studentId,
                    []
                );

            }


            studentRecordsMap
                .get(studentId)
                .push(record);

        }
    );


    students.forEach(
        (
            student,
            index
        ) => {

            const studentRecords =
                studentRecordsMap.get(
                    student.id
                ) || [];


            const stats =
                calculateStats(
                    studentRecords
                );


            const tr =
                document.createElement(
                    'tr'
                );


            tr.innerHTML = `

                <td>
                    ${index + 1}
                </td>

                <td class="student-name-cell">

                    ${escapeHtml(
                        student.name ||
                        'طالب بدون اسم'
                    )}

                </td>

                <td class="number-green">
                    ${stats.حاضر}
                </td>

                <td class="number-red">
                    ${stats.غائب}
                </td>

                <td class="number-blue">
                    ${stats.إجازة}
                </td>

                <td class="number-orange">
                    ${stats.مستأذن}
                </td>

                <td class="number-cyan">
                    ${stats.مراجعة}
                </td>

                <td class="points-cell">
                    ${stats.points}
                </td>

            `;


            halaqaSummaryBody.appendChild(
                tr
            );

        }
    );

}


// ============================================================
// نص ملخص الحلقة
// ============================================================

function generateHalaqaSummaryText(
    students,
    records,
    stats
) {

    if (!pdfSummaryText) {
        return;
    }


    const studentsWithRecords =
        students.filter(
            student =>
                records.some(
                    record =>
                        record.studentId ===
                        student.id
                )
        ).length;


    pdfSummaryText.innerHTML = `

        <div class="summary-grid">

            <div class="summary-mini">

                <span>
                    👥 إجمالي الطلاب
                </span>

                <strong>
                    ${students.length}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    📋 طلاب تم رصدهم
                </span>

                <strong>
                    ${studentsWithRecords}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    ✅ إجمالي الحضور
                </span>

                <strong>
                    ${stats.حاضر}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    ❌ إجمالي الغياب
                </span>

                <strong>
                    ${stats.غائب}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    🔵 الإجازات
                </span>

                <strong>
                    ${stats.إجازة}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    🟠 الاستئذانات
                </span>

                <strong>
                    ${stats.مستأذن}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    🔷 المراجعات
                </span>

                <strong>
                    ${stats.مراجعة}
                </strong>

            </div>


            <div class="summary-mini">

                <span>
                    ⭐ مجموع النقاط
                </span>

                <strong>
                    ${stats.points}
                </strong>

            </div>

        </div>

    `;

}


// ============================================================
// التفاصيل الكاملة للحلقة
// ============================================================

function generateHalaqaDetailed(
    records
) {

    if (!halaqaDetailedBody) {
        return;
    }


    halaqaDetailedBody.innerHTML = '';


    if (!records.length) {

        halaqaDetailedBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-cell"
                >

                    لا توجد سجلات مسجلة لهذه الحلقة
                    في هذا الشهر.

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


            const status =
                getStatusHtml(
                    record.status
                );


            const isPresent =
                record.status ===
                'حاضر';


            const studentName =
                record.studentName ||
                getStudentById(
                    record.studentId
                )?.name ||
                'طالب بدون اسم';


            tr.innerHTML = `

                <td>
                    ${escapeHtml(
                        record.date ||
                        '-'
                    )}
                </td>

                <td class="student-name-cell">
                    ${escapeHtml(
                        studentName
                    )}
                </td>

                <td>
                    ${status}
                </td>

                <td>
                    ${escapeHtml(
                        isPresent
                            ? (
                                record.surah ||
                                '-'
                            )
                            : '-'
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        isPresent
                            ? (
                                record.fromAyah ||
                                '-'
                            )
                            : '-'
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        isPresent
                            ? (
                                record.toAyah ||
                                '-'
                            )
                            : '-'
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        record.grade ||
                        '-'
                    )}
                </td>

                <td class="points-cell">
                    ${Number(
                        record.pointsGiven ||
                        0
                    )}
                </td>

            `;


            halaqaDetailedBody.appendChild(
                tr
            );

        }
    );

}


// ============================================================
// HTML حالة الرصد
// ============================================================

function getStatusHtml(
    status
) {

    const config =
        STATUS_CONFIG[
            status
        ] ||
        {

            icon: '❔',

            className:
                'status-unknown',

            label:
                status ||
                'غير محدد'

        };


    return `

        <span
            class="status-badge ${config.className}"
        >

            ${config.icon}

            ${escapeHtml(
                config.label
            )}

        </span>

    `;

}


// ============================================================
// إخفاء الأقسام
// ============================================================

function hideAllReportSections() {

    if (summarySection) {

        summarySection.style.display =
            'none';

    }


    if (studentDetailedSection) {

        studentDetailedSection.style.display =
            'none';

    }


    if (halaqaSummarySection) {

        halaqaSummarySection.style.display =
            'none';

    }


    if (halaqaDetailedSection) {

        halaqaDetailedSection.style.display =
            'none';

    }

}


// ============================================================
// حالة التحميل
// ============================================================

function showLoadingPreview() {

    if (pdfSummaryText) {

        pdfSummaryText.innerHTML = `

            <div class="loading-preview">

                ⏳ جاري تحميل بيانات التقرير...

            </div>

        `;

    }

}


// ============================================================
// تنظيف المعاينة
// ============================================================

function clearPreview() {

    currentReportData =
        null;


    if (pdfStudentName) {

        pdfStudentName.textContent =
            '-';

    }


    if (pdfHalaqaName) {

        pdfHalaqaName.textContent =
            '-';

    }


    if (pdfMonth) {

        pdfMonth.textContent =
            monthSelect?.value ||
            '-';

    }


    if (pdfHijriMonth) {

        pdfHijriMonth.textContent =
            monthSelect?.value
                ? gregorianToHijri(
                    monthSelect.value
                )
                : '-';

    }


    if (pdfPoints) {

        pdfPoints.textContent =
            '0';

    }


    if (pdfCurrentPoints) {

        pdfCurrentPoints.textContent =
            '0';

    }


    renderStats({

        حاضر: 0,

        غائب: 0,

        إجازة: 0,

        مستأذن: 0,

        مراجعة: 0,

        total: 0,

        points: 0

    });


    if (pdfSummaryText) {

        pdfSummaryText.innerHTML = `

            <div class="empty-preview">

                📊 اختر البيانات من لوحة التحكم
                لعرض التقرير.

            </div>

        `;

    }


    if (pdfTableBody) {

        pdfTableBody.innerHTML = '';

    }


    if (halaqaSummaryBody) {

        halaqaSummaryBody.innerHTML = '';

    }


    if (halaqaDetailedBody) {

        halaqaDetailedBody.innerHTML = '';

    }


    hideAllReportSections();

}


// ============================================================
// حالة الخطأ
// ============================================================

function showErrorState() {

    if (studentSelect) {

        studentSelect.innerHTML =
            '<option value="">❌ تعذر تحميل الطلاب</option>';

    }


    if (halaqaSelect) {

        halaqaSelect.innerHTML =
            '<option value="">❌ تعذر تحميل الحلقات</option>';

    }


    if (pdfSummaryText) {

        pdfSummaryText.innerHTML = `

            <div class="error-preview">

                ❌ حدث خطأ أثناء تحميل بيانات التقارير.

            </div>

        `;

    }

}


// ============================================================
// رسالة
// ============================================================

function showMessage(
    message
) {

    alert(message);

}


// ============================================================
// استخراج PDF
// ============================================================

async function downloadPDF() {

    if (!currentReportData) {

        showMessage(
            '⚠️ اختر الحلقة أو الطالب والشهر أولاً.'
        );

        return;

    }


    const element =
        document.getElementById(
            'pdfContent'
        );


    if (!element) {

        showMessage(
            '❌ تعذر العثور على محتوى التقرير.'
        );

        return;

    }


    const scope =
        currentReportData.scope;


    const month =
        currentReportData.month;


    let fileName;


    if (
        scope ===
        'student'
    ) {

        const studentName =
            cleanText(
                currentReportData
                    .student
                    ?.name
            ) ||
            'طالب';


        fileName =
            `تقرير_${studentName}_${month}.pdf`;

    } else {

        const halaqaName =
            cleanText(
                currentReportData
                    .halaqa
                    ?.name
            ) ||
            'الحلقة';


        fileName =
            `تقرير_حلقة_${halaqaName}_${month}.pdf`;

    }


    const opt = {

        margin: [
            4,
            4,
            4,
            4
        ],

        filename:
            fileName,

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

            logging:
                false,

            scrollX:
                0,

            scrollY:
                0,

            backgroundColor:
                '#ffffff'

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
                '.info-box',
                '.stat-card',
                '.summary-box',
                '.report-table tr',
                '.notes-section',
                '.pdf-footer'
            ]

        }

    };


    if (generatePdfBtn) {

        generatePdfBtn.disabled =
            true;

        generatePdfBtn.innerHTML = `

            <span>
                ⏳
            </span>

            <span>
                جاري استخراج PDF...
            </span>

        `;

    }


    try {

        await html2pdf()
            .set(opt)
            .from(element)
            .save();


    } catch (error) {

        console.error(
            'PDF Export Error:',
            error
        );

        showMessage(
            '❌ حدث خطأ أثناء استخراج التقرير PDF.\n\n' +
            error.message
        );


    } finally {

        if (generatePdfBtn) {

            generatePdfBtn.disabled =
                false;

            generatePdfBtn.innerHTML = `

                <span>
                    📄
                </span>

                <span>
                    استخراج التقرير PDF
                </span>

            `;

        }

    }

}


// ============================================================
// تشغيل افتراضي
// ============================================================

clearPreview();
