import { db, auth, loadAllStudents, loadHalaqatList } from '../../../firebase.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// عناصر الواجهة
const studentSelect = document.getElementById('studentSelect');
const monthSelect = document.getElementById('monthSelect');
const reportTypeSelect = document.getElementById('reportType');
const reportNotes = document.getElementById('reportNotes');
const generatePdfBtn = document.getElementById('generatePdfBtn');

// عناصر التقرير (المرئية للطباعة)
const pdfReportBadge = document.getElementById('pdfReportBadge');
const pdfStudentName = document.getElementById('pdfStudentName');
const pdfHalaqaName = document.getElementById('pdfHalaqaName');
const pdfMonth = document.getElementById('pdfMonth');
const pdfPoints = document.getElementById('pdfPoints');
const pdfAttendCount = document.getElementById('pdfAttendCount');
const pdfAbsentCount = document.getElementById('pdfAbsentCount');
const summarySection = document.getElementById('summarySection');
const pdfSummaryText = document.getElementById('pdfSummaryText');
const detailedSection = document.getElementById('detailedSection');
const pdfTableBody = document.getElementById('pdfTableBody');
const pdfNotesText = document.getElementById('pdfNotesText');

let studentsCache = [];
let halaqatMap = {};

// ==========================================
// 1. التحقق من حالة الدخول ثم التهيئة
// ==========================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    init();
  } else {
    console.warn("⚠️ لم يتم التحقق من حالة الدخول بعد أو لا يوجد مستخدم مسجل.");
    if (studentSelect) {
      studentSelect.innerHTML = '<option value="">⚠️ يرجى تسجيل الدخول أولاً</option>';
    }
  }
});

// ==========================================
// 2. التهيئة وجلب البيانات الأساسية
// ==========================================
async function init() {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (monthSelect) monthSelect.value = currentMonth;

    if (studentSelect) {
      studentSelect.innerHTML = '<option value="">جاري جلب قائمة الطلاب...</option>';
    }

    const [halaqat, students] = await Promise.all([
      loadHalaqatList().catch(err => {
        console.warn("⚠️ تعذر جلب الحلقات:", err);
        return [];
      }),
      loadAllStudents().catch(err => {
        console.error("❌ تعذر جلب الطلاب من Firebase:", err);
        return [];
      })
    ]);

    if (Array.isArray(halaqat)) {
      halaqat.forEach(h => halaqatMap[h.id] = h.name);
    }

    if (Array.isArray(students)) {
      studentsCache = students.map(s => ({
        ...s,
        halaqaName: s.halaqaName || halaqatMap[s.halaqaId] || 'غير محدد'
      }));
    }

    if (!studentSelect) return;

    if (!studentsCache || studentsCache.length === 0) {
      studentSelect.innerHTML = '<option value="">لا يوجد طلاب مسجلون</option>';
      return;
    }

    let options = '<option value="">-- اختر الطالب --</option>';
    studentsCache.forEach(s => {
      options += `<option value="${s.id}">${s.name} (${s.halaqaName})</option>`;
    });
    studentSelect.innerHTML = options;

    setupEventListeners();

  } catch (e) {
    console.error("❌ خطأ عام في التهيئة:", e);
    if (studentSelect) {
      studentSelect.innerHTML = '<option value="">❌ حدث خطأ أثناء جلب البيانات</option>';
    }
  }
}

function setupEventListeners() {
  if (studentSelect) studentSelect.addEventListener('change', updateReportPreview);
  if (monthSelect) monthSelect.addEventListener('change', updateReportPreview);
  if (reportTypeSelect) reportTypeSelect.addEventListener('change', updateReportPreview);
  
  if (reportNotes) {
    reportNotes.addEventListener('input', () => {
      if (pdfNotesText) pdfNotesText.innerText = reportNotes.value.trim() || 'لا توجد ملاحظات.';
    });
  }

  if (generatePdfBtn) {
    generatePdfBtn.addEventListener('click', downloadPDF);
  }
}

// ==========================================
// 3. تحديث وتجميع بيانات التقرير
// ==========================================
async function updateReportPreview() {
  if (!studentSelect || !monthSelect || !reportTypeSelect) return;

  const studentId = studentSelect.value;
  const selectedMonth = monthSelect.value;
  const reportType = reportTypeSelect.value;

  if (!studentId || !selectedMonth) return;

  const student = studentsCache.find(s => s.id === studentId);
  if (!student) return;

  if (pdfStudentName) pdfStudentName.innerText = student.name || 'طالب بدون اسم';
  if (pdfHalaqaName) pdfHalaqaName.innerText = student.halaqaName || 'بدون حلقة';
  if (pdfMonth) pdfMonth.innerText = selectedMonth;
  if (pdfPoints) pdfPoints.innerText = student.totalPoints || 0;
  if (pdfNotesText && reportNotes) pdfNotesText.innerText = reportNotes.value.trim() || 'لا توجد ملاحظات.';

  const records = await fetchStudentRecordsForMonth(studentId, selectedMonth);

  let attendCount = 0;
  let absentCount = 0;

  records.forEach(r => {
    if (r.status === 'حاضر') attendCount++;
    else absentCount++;
  });

  if (pdfAttendCount) pdfAttendCount.innerText = attendCount;
  if (pdfAbsentCount) pdfAbsentCount.innerText = absentCount;

  if (reportType === 'summary') {
    if (pdfReportBadge) pdfReportBadge.innerText = 'تقرير أداء مختصر';
    if (summarySection) summarySection.style.display = 'block';
    if (detailedSection) detailedSection.style.display = 'none';

    generateSummaryReport(records);
  } else {
    if (pdfReportBadge) pdfReportBadge.innerText = 'تقرير أداء تفصيلي';
    if (summarySection) summarySection.style.display = 'none';
    if (detailedSection) detailedSection.style.display = 'block';

    generateDetailedReport(records);
  }
}

// ==========================================
// 4. جلب السجلات من Firestore وتصفيتها
// ==========================================
async function fetchStudentRecordsForMonth(studentId, monthStr) {
  try {
    const q = query(
      collection(db, "records"),
      where("studentId", "==", studentId)
    );
    const snap = await getDocs(q);
    const list = [];

    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.date && data.date.startsWith(monthStr)) {
        list.push({ id: docSnap.id, ...data });
      }
    });

    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return list;

  } catch (e) {
    console.error("خطأ أثناء جلب السجلات:", e);
    return [];
  }
}

// ==========================================
// 5. بناء التقرير المختصر
// ==========================================
function generateSummaryReport(records) {
  if (!pdfSummaryText) return;

  const attendRecords = records.filter(r => r.status === 'حاضر' && r.surah);

  if (attendRecords.length === 0) {
    pdfSummaryText.innerHTML = '⚠️ لا توجد سجلات تسميع محددة لهذا الطالب في هذا الشهر.';
    return;
  }

  const first = attendRecords[0];
  const last = attendRecords[attendRecords.length - 1];

  pdfSummaryText.innerHTML = `
    من <span style="color:var(--primary-green)">سورة ${first.surah}</span> (آية ${first.fromAyah || 1}) 
    إلى <span style="color:var(--primary-green)">سورة ${last.surah}</span> (آية ${last.toAyah || 'النهاية'})
  `;
}

// ==========================================
// 6. بناء التقرير التفصيلي
// ==========================================
function generateDetailedReport(records) {
  if (!pdfTableBody) return;

  pdfTableBody.innerHTML = '';

  if (records.length === 0) {
    pdfTableBody.innerHTML = `<tr><td colspan="7">لا توجد سجلات مسجلة لهذا الشهر.</td></tr>`;
    return;
  }

  records.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date || '-'}</td>
      <td style="color:${r.status === 'حاضر' ? 'green' : 'red'}; font-weight:bold;">${r.status || 'غائب'}</td>
      <td>${r.surah || '-'}</td>
      <td>${r.fromAyah || '-'}</td>
      <td>${r.toAyah || '-'}</td>
      <td>${r.grade || '-'}</td>
      <td>${r.pointsGiven || 0}</td>
    `;
    pdfTableBody.appendChild(tr);
  });
}

// ==========================================
// 7. التصدير المباشر والموثوق (مع الطباعة الافتراضية للكروم)
// ==========================================
async function downloadPDF() {
  if (!studentSelect || !studentSelect.value) {
    alert("يرجى اختيار طالب أولاً!");
    return;
  }

  const element = document.getElementById('pdfContent');
  if (!element) {
    alert("تعذر العثور على محتوى التقرير للطباعة!");
    return;
  }

  const studentName = pdfStudentName ? pdfStudentName.innerText.replace(/\s+/g, '_') : 'طالب';
  const month = monthSelect ? monthSelect.value : '';
  const fileName = `تقرير_${studentName}_${month}.pdf`;

  if (generatePdfBtn) {
    generatePdfBtn.innerText = '⏳ جاري تجهيز التقرير...';
    generatePdfBtn.disabled = true;
  }

  // خيارات HTML2PDF المبسطة والآمنة
  const opt = {
    margin:       0,
    filename:     fileName,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true,
      allowTaint: true,
      windowWidth: 1024 // لضمان ثبات العرض وعدم حدوث انكماش في الموبايل
    },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    // المحاولة الأساسية عبر html2pdf
    if (typeof html2pdf !== 'undefined') {
      await html2pdf().set(opt).from(element).save();
    } else {
      throw new Error("المكتبة غير محملة");
    }
  } catch (err) {
    console.warn("⚠️ تعذر التصدير التلقائي، فتح نافذة الطباعة المباشرة وحفظ كـ PDF...", err);
    // الطريقة المباشرة والأصلية لـ Chrome (فتح طباعة النظام للحفظ كـ PDF)
    window.print();
  } finally {
    if (generatePdfBtn) {
      generatePdfBtn.innerText = '⚡ استخراج التقرير PDF';
      generatePdfBtn.disabled = false;
    }
  }
}
