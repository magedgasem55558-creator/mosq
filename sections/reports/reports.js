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


// ======================================================
// عناصر التحكم
// ======================================================

const scopeSelect =
  document.getElementById('scopeSelect');

const halaqaSelect =
  document.getElementById('halaqaSelect');

const studentSelect =
  document.getElementById('studentSelect');

const monthSelect =
  document.getElementById('monthSelect');

const reportTypeSelect =
  document.getElementById('reportType');

const reportNotes =
  document.getElementById('reportNotes');

const generatePdfBtn =
  document.getElementById('generatePdfBtn');

const halaqaGroup =
  document.getElementById('halaqaGroup');

const studentGroup =
  document.getElementById('studentGroup');


// ======================================================
// عناصر التقرير
// ======================================================

const pdfReportBadge =
  document.getElementById('pdfReportBadge');

const pdfReportType =
  document.getElementById('pdfReportType');

const pdfStudentName =
  document.getElementById('pdfStudentName');

const pdfHalaqaName =
  document.getElementById('pdfHalaqaName');

const pdfMonth =
  document.getElementById('pdfMonth');

const pdfPoints =
  document.getElementById('pdfPoints');

const pdfAttendCount =
  document.getElementById('pdfAttendCount');

const pdfAbsentCount =
  document.getElementById('pdfAbsentCount');

const pdfStudentCount =
  document.getElementById('pdfStudentCount');

const studentSummarySection =
  document.getElementById('studentSummarySection');

const pdfSummaryText =
  document.getElementById('pdfSummaryText');

const halaqaSummarySection =
  document.getElementById('halaqaSummarySection');

const pdfHalaqaSummaryBody =
  document.getElementById('pdfHalaqaSummaryBody');

const detailedSection =
  document.getElementById('detailedSection');

const pdfTableBody =
  document.getElementById('pdfTableBody');

const pdfNotesText =
  document.getElementById('pdfNotesText');

const studentColumnHeader =
  document.getElementById('studentColumnHeader');


// ======================================================
// التخزين المؤقت
// ======================================================

let studentsCache = [];

let halaqatCache = [];

let halaqatMap = {};


// ======================================================
// التحقق من تسجيل الدخول
// ======================================================

onAuthStateChanged(auth, (user) => {

  if (user) {

    init();

  } else {

    console.warn(
      "⚠️ لا يوجد مستخدم مسجل الدخول."
    );

    if (studentSelect) {

      studentSelect.innerHTML =
        '<option value="">⚠️ يرجى تسجيل الدخول أولاً</option>';

    }

  }

});


// ======================================================
// التهيئة
// ======================================================

async function init() {

  try {

    // الشهر الحالي
    const now = new Date();

    const currentMonth =
      `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}`;

    if (monthSelect) {

      monthSelect.value =
        currentMonth;

    }


    // تحميل البيانات
    const [
      halaqat,
      students
    ] = await Promise.all([

      loadHalaqatList().catch(error => {

        console.error(
          "خطأ في تحميل الحلقات:",
          error
        );

        return [];

      }),

      loadAllStudents().catch(error => {

        console.error(
          "خطأ في تحميل الطلاب:",
          error
        );

        return [];

      })

    ]);


    // حفظ الحلقات
    if (Array.isArray(halaqat)) {

      halaqatCache = halaqat;

      halaqat.forEach(halaqa => {

        halaqatMap[halaqa.id] =
          halaqa.name || 'حلقة بدون اسم';

      });

    }


    // حفظ الطلاب
    if (Array.isArray(students)) {

      studentsCache =
        students.map(student => ({

          ...student,

          halaqaName:
            student.halaqaName ||
            halaqatMap[student.halaqaId] ||
            'غير محدد'

        }));

    }


    populateHalaqat();

    populateStudents();

    setupEventListeners();


    // إظهار المعاينة الأولية
    updateReportPreview();


  } catch (error) {

    console.error(
      "❌ خطأ أثناء تهيئة التقارير:",
      error
    );

  }

}


// ======================================================
// تعبئة الحلقات
// ======================================================

function populateHalaqat() {

  if (!halaqaSelect) return;


  halaqaSelect.innerHTML =
    '<option value="">-- اختر الحلقة --</option>';


  halaqatCache.forEach(halaqa => {

    const option =
      document.createElement('option');

    option.value =
      halaqa.id;

    option.textContent =
      halaqa.name || 'حلقة بدون اسم';

    halaqaSelect.appendChild(option);

  });

}


// ======================================================
// تعبئة الطلاب
// ======================================================

function populateStudents() {

  if (!studentSelect) return;


  studentSelect.innerHTML =
    '<option value="">-- اختر الطالب --</option>';


  studentsCache.forEach(student => {

    const option =
      document.createElement('option');

    option.value =
      student.id;

    option.textContent =
      `${student.name || 'طالب بدون اسم'} (${student.halaqaName})`;

    studentSelect.appendChild(option);

  });

}


// ======================================================
// الأحداث
// ======================================================

function setupEventListeners() {


  // تغيير نطاق التقرير
  scopeSelect?.addEventListener(
    'change',
    () => {

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


      updateReportPreview();

    }
  );


  // تغيير الحلقة
  halaqaSelect?.addEventListener(
    'change',
    updateReportPreview
  );


  // تغيير الطالب
  studentSelect?.addEventListener(
    'change',
    updateReportPreview
  );


  // تغيير الشهر
  monthSelect?.addEventListener(
    'change',
    updateReportPreview
  );


  // تغيير مستوى التقرير
  reportTypeSelect?.addEventListener(
    'change',
    updateReportPreview
  );


  // الملاحظات
  reportNotes?.addEventListener(
    'input',
    () => {

      if (pdfNotesText) {

        pdfNotesText.innerText =
          reportNotes.value.trim() ||
          'لا توجد ملاحظات.';

      }

    }
  );


  // PDF
  generatePdfBtn?.addEventListener(
    'click',
    downloadPDF
  );

}


// ======================================================
// تحديث التقرير
// ======================================================

async function updateReportPreview() {

  const scope =
    scopeSelect?.value || 'student';

  const month =
    monthSelect?.value;

  const reportType =
    reportTypeSelect?.value || 'summary';


  if (!month) return;


  // تنظيف التقرير
  resetReport();


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


  if (pdfNotesText) {

    pdfNotesText.innerText =
      reportNotes?.value.trim() ||
      'لا توجد ملاحظات.';

  }

}


// ======================================================
// تقرير الطالب
// ======================================================

async function generateStudentReport(
  month,
  reportType
) {

  const studentId =
    studentSelect?.value;


  if (!studentId) {

    pdfReportBadge.innerText =
      'تقرير أداء الطالب';

    pdfReportType.innerText =
      'تقرير طالب';

    pdfStudentName.innerText =
      'يرجى اختيار طالب';

    return;

  }


  const student =
    studentsCache.find(
      item => item.id === studentId
    );


  if (!student) return;


  const records =
    await fetchStudentRecordsForMonth(
      studentId,
      month
    );


  const stats =
    calculateStudentStats(records);


  // البيانات العامة
  pdfReportBadge.innerText =
    reportType === 'summary'
      ? 'تقرير أداء مختصر'
      : 'تقرير أداء تفصيلي';

  pdfReportType.innerText =
    'تقرير طالب';

  pdfStudentName.innerText =
    student.name || 'طالب بدون اسم';

  pdfHalaqaName.innerText =
    student.halaqaName || 'غير محدد';

  pdfMonth.innerText =
    formatMonth(month);

  pdfPoints.innerText =
    stats.points;

  pdfAttendCount.innerText =
    stats.attendance;

  pdfAbsentCount.innerText =
    stats.absence;

  pdfStudentCount.innerText =
    '1';


  if (reportType === 'summary') {

    studentSummarySection.style.display =
      'block';

    halaqaSummarySection.style.display =
      'none';

    detailedSection.style.display =
      'none';


    generateStudentSummary(
      records
    );

  } else {

    studentSummarySection.style.display =
      'none';

    halaqaSummarySection.style.display =
      'none';

    detailedSection.style.display =
      'block';


    studentColumnHeader.style.display =
      'none';


    generateStudentDetailedReport(
      records
    );

  }

}


// ======================================================
// تقرير الحلقة كاملة
// ======================================================

async function generateHalaqaReport(
  month,
  reportType
) {

  const halaqaId =
    halaqaSelect?.value;


  if (!halaqaId) {

    pdfReportBadge.innerText =
      'تقرير الحلقة';

    pdfReportType.innerText =
      'تقرير حلقة';

    pdfStudentName.innerText =
      'يرجى اختيار الحلقة';

    return;

  }


  const halaqa =
    halaqatCache.find(
      item => item.id === halaqaId
    );


  const halaqaName =
    halaqa?.name ||
    halaqatMap[halaqaId] ||
    'حلقة بدون اسم';


  // جميع طلاب الحلقة
  const halaqaStudents =
    studentsCache.filter(
      student =>
        student.halaqaId === halaqaId ||
        student.halaqaName === halaqaName
    );


  if (halaqaStudents.length === 0) {

    pdfReportBadge.innerText =
      'تقرير الحلقة';

    pdfReportType.innerText =
      'تقرير حلقة';

    pdfStudentName.innerText =
      halaqaName;

    pdfHalaqaName.innerText =
      halaqaName;

    pdfMonth.innerText =
      formatMonth(month);

    pdfSummaryText.innerText =
      'لا يوجد طلاب مسجلون في هذه الحلقة.';

    studentSummarySection.style.display =
      'block';

    return;

  }


  // تحميل سجلات جميع الطلاب
  const studentsWithRecords =
    await Promise.all(

      halaqaStudents.map(
        async student => {

          const records =
            await fetchStudentRecordsForMonth(
              student.id,
              month
            );

          const stats =
            calculateStudentStats(
              records
            );

          return {

            student,
            records,
            stats

          };

        }
      )

    );


  // إحصائيات الحلقة
  let totalAttendance = 0;

  let totalAbsence = 0;

  let totalPoints = 0;

  let totalRecitations = 0;


  studentsWithRecords.forEach(
    item => {

      totalAttendance +=
        item.stats.attendance;

      totalAbsence +=
        item.stats.absence;

      totalPoints +=
        item.stats.points;

      totalRecitations +=
        item.stats.recitations;

    }
  );


  // البيانات العامة
  pdfReportBadge.innerText =
    reportType === 'summary'
      ? 'تقرير الحلقة - مختصر'
      : 'تقرير الحلقة - تفصيلي';


  pdfReportType.innerText =
    'تقرير الحلقة كاملة';


  pdfStudentName.innerText =
    halaqaName;


  pdfHalaqaName.innerText =
    halaqaName;


  pdfMonth.innerText =
    formatMonth(month);


  pdfStudentCount.innerText =
    halaqaStudents.length;


  pdfAttendCount.innerText =
    totalAttendance;


  pdfAbsentCount.innerText =
    totalAbsence;


  pdfPoints.innerText =
    totalPoints;


  if (reportType === 'summary') {

    studentSummarySection.style.display =
      'none';

    halaqaSummarySection.style.display =
      'block';

    detailedSection.style.display =
      'none';


    generateHalaqaSummaryReport(
      studentsWithRecords
    );

  } else {

    studentSummarySection.style.display =
      'none';

    halaqaSummarySection.style.display =
      'none';

    detailedSection.style.display =
      'block';


    studentColumnHeader.style.display =
      'table-cell';


    generateHalaqaDetailedReport(
      studentsWithRecords
    );

  }

}


// ======================================================
// جلب سجلات طالب لشهر محدد
// ======================================================

async function fetchStudentRecordsForMonth(
  studentId,
  monthStr
) {

  try {

    const q =
      query(
        collection(db, 'records'),
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
          data.date &&
          data.date.startsWith(monthStr)
        ) {

          records.push({

            id: docSnap.id,

            ...data

          });

        }

      }
    );


    records.sort(
      (a, b) =>
        (a.date || '').localeCompare(
          b.date || ''
        )
    );


    return records;


  } catch (error) {

    console.error(
      `خطأ في جلب سجلات الطالب ${studentId}:`,
      error
    );

    return [];

  }

}


// ======================================================
// حساب إحصائيات الطالب
// ======================================================

function calculateStudentStats(records) {

  let attendance = 0;

  let absence = 0;

  let points = 0;

  let recitations = 0;


  records.forEach(record => {

    if (record.status === 'حاضر') {

      attendance++;

    } else {

      absence++;

    }


    if (
      record.surah ||
      record.fromAyah ||
      record.toAyah
    ) {

      recitations++;

    }


    points +=
      Number(record.pointsGiven) || 0;

  });


  return {

    attendance,

    absence,

    points,

    recitations

  };

}


// ======================================================
// ملخص الطالب
// ======================================================

function generateStudentSummary(
  records
) {

  if (!pdfSummaryText) return;


  const attendRecords =
    records.filter(
      record =>
        record.status === 'حاضر' &&
        record.surah
    );


  if (attendRecords.length === 0) {

    pdfSummaryText.innerHTML =
      '⚠️ لا توجد سجلات تسميع محددة لهذا الطالب في هذا الشهر.';

    return;

  }


  const first =
    attendRecords[0];

  const last =
    attendRecords[
      attendRecords.length - 1
    ];


  pdfSummaryText.innerHTML = `

    <div style="line-height:2.2">

      <div>
        <strong>بداية الإنجاز:</strong>
        سورة ${escapeHtml(first.surah)}
        -
        آية ${escapeHtml(first.fromAyah || 1)}
      </div>

      <div>
        <strong>آخر إنجاز:</strong>
        سورة ${escapeHtml(last.surah)}
        -
        آية ${escapeHtml(last.toAyah || 'النهاية')}
      </div>

      <div>
        <strong>عدد جلسات التسميع:</strong>
        ${attendRecords.length}
      </div>

    </div>

  `;

}


// ======================================================
// ملخص الحلقة
// ======================================================

function generateHalaqaSummaryReport(
  studentsWithRecords
) {

  if (!pdfHalaqaSummaryBody)
    return;


  pdfHalaqaSummaryBody.innerHTML = '';


  if (studentsWithRecords.length === 0) {

    pdfHalaqaSummaryBody.innerHTML = `
      <tr>
        <td colspan="7">
          لا توجد بيانات.
        </td>
      </tr>
    `;

    return;

  }


  studentsWithRecords.forEach(
    (item, index) => {

      const student =
        item.student;

      const stats =
        item.stats;

      const records =
        item.records;


      const recitations =
        records.filter(
          record =>
            record.status === 'حاضر' &&
            record.surah
        );


      let achievement = '-';


      if (recitations.length > 0) {

        const first =
          recitations[0];

        const last =
          recitations[
            recitations.length - 1
          ];


        achievement =
          `${first.surah} (${first.fromAyah || 1}) → ${last.surah} (${last.toAyah || 'النهاية'})`;

      }


      const tr =
        document.createElement('tr');


      tr.innerHTML = `

        <td>
          ${index + 1}
        </td>

        <td>
          ${escapeHtml(student.name || '-')}
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
          ${stats.points}
        </td>

        <td>
          ${escapeHtml(achievement)}
        </td>

      `;


      pdfHalaqaSummaryBody.appendChild(
        tr
      );

    }
  );

}


// ======================================================
// التقرير التفصيلي للطالب
// ======================================================

function generateStudentDetailedReport(
  records
) {

  if (!pdfTableBody)
    return;


  pdfTableBody.innerHTML = '';


  if (records.length === 0) {

    pdfTableBody.innerHTML = `

      <tr>
        <td colspan="8">
          لا توجد سجلات مسجلة لهذا الشهر.
        </td>
      </tr>

    `;

    return;

  }


  records.forEach(record => {

    const tr =
      document.createElement('tr');


    tr.innerHTML = `

      <td style="display:none;">
        -
      </td>

      <td>
        ${escapeHtml(record.date || '-')}
      </td>

      <td
        style="
          color:${record.status === 'حاضر'
            ? 'green'
            : 'red'};
          font-weight:bold;
        "
      >
        ${escapeHtml(record.status || 'غائب')}
      </td>

      <td>
        ${escapeHtml(record.surah || '-')}
      </td>

      <td>
        ${escapeHtml(record.fromAyah || '-')}
      </td>

      <td>
        ${escapeHtml(record.toAyah || '-')}
      </td>

      <td>
        ${escapeHtml(record.grade || '-')}
      </td>

      <td>
        ${Number(record.pointsGiven) || 0}
      </td>

    `;


    pdfTableBody.appendChild(tr);

  });

}


// ======================================================
// التقرير التفصيلي للحلقة
// ======================================================

function generateHalaqaDetailedReport(
  studentsWithRecords
) {

  if (!pdfTableBody)
    return;


  pdfTableBody.innerHTML = '';


  let rowCount = 0;


  studentsWithRecords.forEach(
    item => {

      const student =
        item.student;

      const records =
        item.records;


      records.forEach(record => {

        rowCount++;


        const tr =
          document.createElement('tr');


        tr.innerHTML = `

          <td>
            ${escapeHtml(student.name || '-')}
          </td>

          <td>
            ${escapeHtml(record.date || '-')}
          </td>

          <td
            style="
              color:${record.status === 'حاضر'
                ? 'green'
                : 'red'};
              font-weight:bold;
            "
          >
            ${escapeHtml(record.status || 'غائب')}
          </td>

          <td>
            ${escapeHtml(record.surah || '-')}
          </td>

          <td>
            ${escapeHtml(record.fromAyah || '-')}
          </td>

          <td>
            ${escapeHtml(record.toAyah || '-')}
          </td>

          <td>
            ${escapeHtml(record.grade || '-')}
          </td>

          <td>
            ${Number(record.pointsGiven) || 0}
          </td>

        `;


        pdfTableBody.appendChild(tr);

      });

    }
  );


  if (rowCount === 0) {

    pdfTableBody.innerHTML = `

      <tr>
        <td colspan="8">
          لا توجد سجلات مسجلة لهذه الحلقة في هذا الشهر.
        </td>
      </tr>

    `;

  }

}


// ======================================================
// تنظيف التقرير
// ======================================================

function resetReport() {

  if (pdfStudentName)
    pdfStudentName.innerText = '-';

  if (pdfHalaqaName)
    pdfHalaqaName.innerText = '-';

  if (pdfMonth)
    pdfMonth.innerText = '-';

  if (pdfPoints)
    pdfPoints.innerText = '0';

  if (pdfAttendCount)
    pdfAttendCount.innerText = '0';

  if (pdfAbsentCount)
    pdfAbsentCount.innerText = '0';

  if (pdfStudentCount)
    pdfStudentCount.innerText = '0';

  if (pdfSummaryText)
    pdfSummaryText.innerHTML = '';

  if (pdfTableBody)
    pdfTableBody.innerHTML = '';

  if (pdfHalaqaSummaryBody)
    pdfHalaqaSummaryBody.innerHTML = '';

}


// ======================================================
// تنسيق الشهر
// ======================================================

function formatMonth(month) {

  if (!month)
    return '-';


  const parts =
    month.split('-');


  if (parts.length !== 2)
    return month;


  const year =
    parts[0];

  const monthNumber =
    Number(parts[1]);


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


  return `${names[monthNumber - 1] || parts[1]} ${year}`;

}


// ======================================================
// حماية النصوص من HTML
// ======================================================

function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }


  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


// ======================================================
// استخراج PDF
// ======================================================

async function downloadPDF() {

  const scope =
    scopeSelect?.value || 'student';


  const month =
    monthSelect?.value || '';


  if (scope === 'student') {

    if (!studentSelect?.value) {

      alert(
        'يرجى اختيار طالب أولاً.'
      );

      return;

    }

  } else {

    if (!halaqaSelect?.value) {

      alert(
        'يرجى اختيار الحلقة أولاً.'
      );

      return;

    }

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
    pdfStudentName?.innerText
      ?.trim()
      ?.replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, '_') ||
    'تقرير';


  const safeMonth =
    month.replace('-', '_');


  const filename =
    scope === 'halaqa'
      ? `تقرير_الحلقة_${name}_${safeMonth}.pdf`
      : `تقرير_${name}_${safeMonth}.pdf`;


  const originalText =
    generatePdfBtn.innerText;


  generatePdfBtn.innerText =
    '⏳ جاري استخراج PDF...';


  generatePdfBtn.disabled =
    true;


  // التأكد من اكتمال عرض التقرير
  await new Promise(
    resolve =>
      setTimeout(resolve, 300)
  );


  const opt = {

    margin: [
      5,
      5,
      5,
      5
    ],

    filename,

    image: {
      type: 'jpeg',
      quality: 0.98
    },

    html2canvas: {

      scale: 2,

      useCORS: true,

      allowTaint: true,

      logging: false,

      scrollX: 0,

      scrollY: 0

    },

    jsPDF: {

      unit: 'mm',

      format: 'a4',

      orientation: 'portrait'

    },

    pagebreak: {

      mode: [
        'css',
        'legacy'
      ]

    }

  };


  try {

    await html2pdf()
      .set(opt)
      .from(element)
      .save();


  } catch (error) {

    console.error(
      '❌ خطأ أثناء إنشاء PDF:',
      error
    );


    alert(
      'حدث خطأ أثناء استخراج التقرير PDF.'
    );


  } finally {

    generatePdfBtn.innerText =
      originalText;

    generatePdfBtn.disabled =
      false;

  }

}
