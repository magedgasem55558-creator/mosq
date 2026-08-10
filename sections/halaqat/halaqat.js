// ============================================================
// 📖 رصد التسميع والحضور - حلقات القرآن
// + 💬 محادثة ولي الأمر مرتبطة بالحلقة والطالب
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
    increment,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ============================================================
// 🔐 Firebase Auth
// ============================================================

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const auth = getAuth();


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

const editButton =
    document.getElementById('editTodayRecordBtn');

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

const recordMode =
    document.getElementById('recordMode');


// ============================================================
// 💬 عناصر المحادثة
// ============================================================

const chatParentButton =
    document.getElementById('chatParentBtn');

const parentChatSection =
    document.getElementById('parentChatSection');

const closeChatButton =
    document.getElementById('closeChatBtn');

const chatMessages =
    document.getElementById('chatMessages');

const chatMessageInput =
    document.getElementById('chatMessageInput');

const sendChatMessageButton =
    document.getElementById('sendChatMessageBtn');

const chatStudentName =
    document.getElementById('chatStudentName');

const chatHalaqaName =
    document.getElementById('chatHalaqaName');


// ============================================================
// 🔹 متغيرات التطبيق
// ============================================================

let halaqat = [];

const studentsCache = new Map();

let currentTodayRecord = null;

let isEditMode = false;


// ============================================================
// 💬 مستمع المحادثة الحالي
// ============================================================

let unsubscribeChat = null;

let currentChatStudent = null;

let currentChatHalaqa = null;


// ============================================================
// 📅 تاريخ اليوم
// ============================================================

function getTodayDate() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, '0');

    const day =
        String(
            now.getDate()
        ).padStart(2, '0');

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
            '📤 حفظ وإرسال التحديث للأهل';
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
        halaqa =>
            halaqa.id === halaqaId
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

        updateAttendanceSummary(
            0,
            0
        );


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

async function getTodayAttendance(
    halaqaId
) {

    const today =
        getTodayDate();


    const recordsQuery =
        query(

            collection(
                db,
                'records'
            ),

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
        await getDocs(
            recordsQuery
        );


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
                recordId:
                    recordDoc.id,

                ...record,

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

async function loadStudentsByHalaqa(
    halaqaId
) {

    studentSelect.innerHTML = '';

    studentsCache.clear();

    currentTodayRecord = null;

    hideEditMode();

    closeParentChat();


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

            updateAttendanceSummary(
                0,
                0
            );

            return;
        }


        studentSelect.innerHTML = '';


        const defaultOption =
            document.createElement('option');

        defaultOption.value = '';

        defaultOption.textContent =
            'اختر الطالب...';

        studentSelect.appendChild(
            defaultOption
        );


        const students = [];


        studentsSnapshot.forEach(
            studentDoc => {

                const student =
                    studentDoc.data();

                students.push({

                    id:
                        studentDoc.id,

                    ...student
                });
            }
        );


        students.sort((a, b) => {

            const nameA =
                String(
                    a.name || ''
                );

            const nameB =
                String(
                    b.name || ''
                );

            return nameA.localeCompare(
                nameB,
                'ar'
            );
        });


        let recordedCount = 0;


        students.forEach(student => {

            studentsCache.set(
                student.id,
                student
            );


            const option =
                document.createElement(
                    'option'
                );


            option.value =
                student.id;


            const studentName =
                student.name ||
                'طالب بدون اسم';


            const attendance =
                todayAttendance.get(
                    student.id
                );


            if (attendance) {

                recordedCount++;


                let icon =
                    '✅';

                let statusText =
                    'تم الرصد';


                switch (
                    attendance.status
                ) {

                    case 'حاضر':

                        icon =
                            '✅';

                        statusText =
                            'حاضر';

                        break;


                    case 'غائب':

                        icon =
                            '❌';

                        statusText =
                            'غائب';

                        break;


                    case 'إجازة':

                        icon =
                            '🔵';

                        statusText =
                            'إجازة';

                        break;


                    case 'مستأذن':

                        icon =
                            '🟠';

                        statusText =
                            'مستأذن';

                        break;
                }


                option.textContent =
                    `${icon} ${studentName} — ${statusText}`;


                option.dataset.recorded =
                    'true';


                option.dataset.status =
                    attendance.status || '';


                option.dataset.recordId =
                    attendance.recordId;


                option.dataset.record =
                    JSON.stringify(
                        attendance
                    );


            } else {

                option.textContent =
                    `⬜ ${studentName} — لم يُرصد`;


                option.dataset.recorded =
                    'false';


                option.dataset.status =
                    '';


                option.dataset.recordId =
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
            document.createElement(
                'option'
            );


        errorOption.value = '';

        errorOption.textContent =
            '❌ تعذر تحميل الطلاب';


        studentSelect.appendChild(
            errorOption
        );


        studentSelect.disabled =
            true;


        updateAttendanceSummary(
            0,
            0
        );


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
        Math.max(
            total - recorded,
            0
        );


    const percentage =
        total > 0
            ? Math.round(
                (recorded / total) * 100
            )
            : 0;


    attendanceSummary.innerHTML = `

        <div class="summary-header">

            <span>
                📊 حالة رصد اليوم
            </span>

            <strong>
                ${percentage}%
            </strong>

        </div>


        <div class="summary-stats">

            <div class="summary-item">

                <span class="summary-icon">
                    👥
                </span>

                <div>

                    <small>
                        إجمالي الطلاب
                    </small>

                    <strong>
                        ${total}
                    </strong>

                </div>

            </div>


            <div class="summary-item">

                <span class="summary-icon">
                    ✅
                </span>

                <div>

                    <small>
                        تم الرصد
                    </small>

                    <strong>
                        ${recorded}
                    </strong>

                </div>

            </div>


            <div class="summary-item">

                <span class="summary-icon">
                    ⬜
                </span>

                <div>

                    <small>
                        المتبقي
                    </small>

                    <strong>
                        ${remaining}
                    </strong>

                </div>

            </div>

        </div>


        <div class="summary-progress">

            <div
                style="width:${percentage}%"
            ></div>

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


        studentSelect.disabled =
            true;


        studentsCache.clear();

        currentTodayRecord = null;

        hideEditMode();

        closeParentChat();


        updateAttendanceSummary(
            0,
            0
        );


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

            hideEditMode();

            closeParentChat();

            return;
        }


        const recorded =
            selectedOption.dataset.recorded ===
            'true';


        const student =
            getSelectedStudent();


        /*
         * فتح زر المحادثة بمجرد اختيار الطالب
         */
        if (student) {

            showChatButton();

        }


        if (!recorded) {

            currentTodayRecord =
                null;

            hideEditMode();

            resetFormAfterNewStudent();

            return;
        }


        try {

            currentTodayRecord =
                JSON.parse(
                    selectedOption.dataset.record
                );

        } catch {

            currentTodayRecord =
                null;
        }


        showEditMode();

    }
);


// ============================================================
// 💬 إظهار زر المحادثة
// ============================================================

function showChatButton() {

    if (!chatParentButton) {
        return;
    }


    chatParentButton.style.display =
        'flex';
}


// ============================================================
// 💬 إخفاء زر المحادثة
// ============================================================

function hideChatButton() {

    if (!chatParentButton) {
        return;
    }


    chatParentButton.style.display =
        'none';
}


// ============================================================
// ✏️ إظهار وضع التعديل
// ============================================================

function showEditMode() {

    isEditMode = true;


    if (recordMode) {

        recordMode.textContent =
            '✏️ تعديل رصد اليوم';

        recordMode.className =
            'record-mode edit';
    }


    if (editButton) {
        editButton.style.display =
            'flex';
    }


    if (saveButton) {

        saveButton.innerHTML = `
            <span>💾</span>
            <span>حفظ تعديل رصد اليوم</span>
        `;
    }


    fillFormFromRecord(
        currentTodayRecord
    );
}


// ============================================================
// ➕ وضع رصد جديد
// ============================================================

function hideEditMode() {

    isEditMode = false;


    if (recordMode) {

        recordMode.textContent =
            '📝 رصد جديد';

        recordMode.className =
            'record-mode new';
    }


    if (editButton) {

        editButton.style.display =
            'none';
    }


    if (saveButton) {

        saveButton.innerHTML = `
            <span>📤</span>
            <span>حفظ وإرسال التحديث للأهل</span>
        `;
    }
}


// ============================================================
// 📝 تعبئة النموذج
// ============================================================

function fillFormFromRecord(
    record
) {

    if (!record) {
        return;
    }


    attendanceStatus.value =
        record.status ||
        'حاضر';


    currentSurah.value =
        record.surah || '';


    fromAya.value =
        record.fromAyah || '';


    toAya.value =
        record.toAyah || '';


    tomorrowReq.value =
        record.tomorrowRequirement ===
        'لا يوجد'

            ? ''

            : (
                record.tomorrowRequirement ||
                ''
            );


    teacherNotes.value =
        record.notes || '';


    pointsGiven.value =
        Number(
            record.pointsGiven || 0
        );


    const values =
        String(
            record.grade || ''
        )
        .split(' - ')
        .map(
            value =>
                value.trim()
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


    updateRecitationVisibility();
}


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


    recitationFields.style.display =
        isPresent
            ? 'block'
            : 'none';


    if (!isEditMode) {

        pointsGiven.value =
            isPresent
                ? '10'
                : '0';
    }


    if (!isPresent) {

        currentSurah.value = '';

        fromAya.value = '';

        toAya.value = '';


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
}


// ============================================================
// 🔎 التحقق
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


    if (!isEditMode) {

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
                    `هل تريد تعديل رصد اليوم؟`
                );


            if (!confirmAgain) {
                return false;
            }


            try {

                currentTodayRecord =
                    JSON.parse(
                        selectedOption.dataset.record
                    );

                isEditMode =
                    true;

            } catch {

                showMessage(
                    '❌ تعذر قراءة السجل الحالي.'
                );

                return false;
            }
        }
    }


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
// ⭐ التقييم
// ============================================================

function getGrade(status) {

    if (status !== 'حاضر') {
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


    if (evaluations.length > 0) {

        return evaluations.join(
            ' - '
        );
    }


    return 'جيد';
}


// ============================================================
// 📦 تجهيز بيانات السجل
// ============================================================

function buildRecordData(
    selectedHalaqa,
    selectedStudent
) {

    const status =
        attendanceStatus.value;


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


    if (status !== 'حاضر') {
        points = 0;
    }


    const grade =
        getGrade(status);


    const teacherPhone =
        selectedHalaqa.teacherPhone ||
        '';


    return {

        studentId:
            selectedStudent.id,

        studentName:
            selectedStudent.name || '',

        parentId:
            selectedStudent.parentId ||
            selectedStudent.parentUid ||
            selectedStudent.guardianId ||
            '',


        halaqaId:
            selectedHalaqa.id,

        halaqaName:
            selectedHalaqa.name || '',


        teacherId:
            selectedHalaqa.teacherId ||
            selectedHalaqa.teacherUid ||
            '',

        teacherName:
            selectedHalaqa.teacherName || '',

        teacherPhone,


        status,


        surah:
            status === 'حاضر'
                ? surah
                : status,


        fromAyah:
            from,

        toAyah:
            to,


        grade,


        tomorrowRequirement,


        notes,


        pointsGiven:
            points,


        date:
            getTodayDate(),


        updatedAt:
            serverTimestamp()
    };
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


    const recordData =
        buildRecordData(
            selectedHalaqa,
            selectedStudent
        );


    setButtonLoading(true);


    try {

        // ====================================================
        // ✏️ تعديل
        // ====================================================

        if (
            isEditMode &&
            currentTodayRecord &&
            currentTodayRecord.recordId
        ) {

            const oldPoints =
                Number(
                    currentTodayRecord.pointsGiven ||
                    0
                );


            const newPoints =
                Number(
                    recordData.pointsGiven ||
                    0
                );


            await updateDoc(

                doc(
                    db,
                    'records',
                    currentTodayRecord.recordId
                ),

                recordData
            );


            const pointsDifference =
                newPoints - oldPoints;


            if (pointsDifference !== 0) {

                await updateDoc(

                    doc(
                        db,
                        'students',
                        studentId
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
                `✅ تم تعديل رصد الطالب بنجاح\n\n` +
                `👤 الطالب: ${selectedStudent.name}\n` +
                `📌 الحالة: ${recordData.status}\n` +
                `⭐ النقاط: ${newPoints}`
            );


        } else {

            // =================================================
            // ➕ إضافة
            // =================================================

            const existingQuery =
                query(

                    collection(
                        db,
                        'records'
                    ),

                    where(
                        'halaqaId',
                        '==',
                        halaqaId
                    ),

                    where(
                        'studentId',
                        '==',
                        studentId
                    ),

                    where(
                        'date',
                        '==',
                        getTodayDate()
                    )
                );


            const existingSnapshot =
                await getDocs(
                    existingQuery
                );


            if (!existingSnapshot.empty) {

                showMessage(
                    '⚠️ يوجد بالفعل رصد لهذا الطالب اليوم.\n\n' +
                    'سيتم فتح السجل للتعديل.'
                );


                const first =
                    existingSnapshot.docs[0];


                currentTodayRecord = {

                    recordId:
                        first.id,

                    ...first.data()
                };


                showEditMode();

                setButtonLoading(false);

                return;
            }


            await addDoc(

                collection(
                    db,
                    'records'
                ),

                {
                    ...recordData,

                    timestamp:
                        serverTimestamp()
                }
            );


            const points =
                Number(
                    recordData.pointsGiven ||
                    0
                );


            if (points > 0) {

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


            showMessage(
                `✅ تم حفظ الرصد بنجاح\n\n` +
                `👤 الطالب: ${selectedStudent.name}\n` +
                `📌 الحالة: ${recordData.status}\n` +
                `⭐ النقاط: ${points}\n` +
                `📊 التقييم: ${recordData.grade}`
            );
        }


        await loadStudentsByHalaqa(
            halaqaId
        );


        /*
         * نعيد اختيار الطالب
         * حتى تبقى المحادثة مرتبطة به.
         */

        studentSelect.value =
            studentId;


        studentSelect.dispatchEvent(
            new Event('change')
        );


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
// 🧹 تنظيف النموذج
// ============================================================

function resetFormAfterSave() {

    currentSurah.value = '';

    fromAya.value = '';

    toAya.value = '';

    tomorrowReq.value = '';

    teacherNotes.value = '';

    pointsGiven.value =
        '10';


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


    currentTodayRecord =
        null;


    isEditMode =
        false;


    hideEditMode();
}


// ============================================================
// 🆕 طالب جديد
// ============================================================

function resetFormAfterNewStudent() {

    attendanceStatus.value =
        'حاضر';


    currentSurah.value =
        '';

    fromAya.value =
        '';

    toAya.value =
        '';

    tomorrowReq.value =
        '';

    teacherNotes.value =
        '';

    pointsGiven.value =
        '10';


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


    updateRecitationVisibility();
}


// ============================================================
// ✏️ زر تعديل
// ============================================================

if (editButton) {

    editButton.addEventListener(
        'click',
        () => {

            if (!currentTodayRecord) {

                showMessage(
                    '⚠️ لا يوجد سجل لليوم.'
                );

                return;
            }


            showEditMode();


            window.scrollTo({

                top:
                    0,

                behavior:
                    'smooth'
            });
        }
    );
}


// ============================================================
// 💬 فتح محادثة ولي الأمر
// ============================================================

if (chatParentButton) {

    chatParentButton.addEventListener(
        'click',
        openParentChat
    );
}


// ============================================================
// 💬 فتح المحادثة
// ============================================================

function openParentChat() {

    const student =
        getSelectedStudent();


    const halaqa =
        getSelectedHalaqa();


    if (!student) {

        showMessage(
            '⚠️ اختر الطالب أولاً.'
        );

        return;
    }


    if (!halaqa) {

        showMessage(
            '⚠️ اختر الحلقة أولاً.'
        );

        return;
    }


    const parentId =
        student.parentId ||
        student.parentUid ||
        student.guardianId ||
        '';


    if (!parentId) {

        showMessage(
            '⚠️ لا يوجد حساب ولي أمر مرتبط بهذا الطالب.'
        );

        return;
    }


    currentChatStudent =
        student;


    currentChatHalaqa =
        halaqa;


    chatStudentName.textContent =
        `ولي أمر ${student.name || 'الطالب'}`;


    chatHalaqaName.textContent =
        `📖 ${halaqa.name || 'الحلقة'}`;


    parentChatSection.style.display =
        'block';


    subscribeToChat(
        student,
        halaqa,
        parentId
    );


    setTimeout(
        () => {

            chatMessageInput.focus();

        },
        100
    );
}


// ============================================================
// 💬 إغلاق المحادثة
// ============================================================

if (closeChatButton) {

    closeChatButton.addEventListener(
        'click',
        closeParentChat
    );
}


function closeParentChat() {

    if (unsubscribeChat) {

        unsubscribeChat();

        unsubscribeChat =
            null;
    }


    currentChatStudent =
        null;

    currentChatHalaqa =
        null;


    if (parentChatSection) {

        parentChatSection.style.display =
            'none';
    }
}


// ============================================================
// 🔴 مراقبة الرسائل مباشرة
// ============================================================

function subscribeToChat(
    student,
    halaqa,
    parentId
) {

    if (unsubscribeChat) {

        unsubscribeChat();

        unsubscribeChat =
            null;
    }


    chatMessages.innerHTML = `

        <div class="chat-empty">

            ⏳

            <strong>
                جاري تحميل المحادثة...
            </strong>

        </div>

    `;


    /*
     * مهم:
     *
     * المحادثة مرتبطة بـ:
     *
     * halaqaId
     * studentId
     * parentId
     *
     * لذلك لن تظهر رسائل
     * طالب من حلقة أخرى.
     */

    const messagesQuery =
        query(

            collection(
                db,
                'messages'
            ),

            where(
                'halaqaId',
                '==',
                halaqa.id
            ),

            where(
                'studentId',
                '==',
                student.id
            ),

            where(
                'parentId',
                '==',
                parentId
            ),

            orderBy(
                'createdAt',
                'asc'
            )
        );


    unsubscribeChat =
        onSnapshot(

            messagesQuery,

            snapshot => {

                renderChatMessages(
                    snapshot
                );

            },

            error => {

                console.error(
                    'Chat Listener Error:',
                    error
                );


                chatMessages.innerHTML = `

                    <div class="chat-empty">

                        ❌

                        <strong>
                            تعذر تحميل المحادثة
                        </strong>

                        <small>
                            تحقق من اتصال الإنترنت وصلاحيات Firestore.
                        </small>

                    </div>

                `;
            }
        );
}


// ============================================================
// 💬 عرض الرسائل
// ============================================================

function renderChatMessages(
    snapshot
) {

    if (snapshot.empty) {

        chatMessages.innerHTML = `

            <div class="chat-empty">

                💬

                <strong>
                    لا توجد رسائل بعد
                </strong>

                <small>
                    عند إرسال ولي الأمر رسالة ستظهر هنا مباشرة.
                </small>

            </div>

        `;

        return;
    }


    chatMessages.innerHTML = '';


    snapshot.forEach(
        messageDoc => {

            const message =
                messageDoc.data();


            const senderRole =
                message.senderRole ||
                'parent';


            const isTeacher =
                senderRole ===
                'teacher';


            const messageElement =
                document.createElement(
                    'div'
                );


            messageElement.className =
                `chat-message ${
                    isTeacher
                        ? 'teacher'
                        : 'parent'
                }`;


            const text =
                cleanText(
                    message.text
                );


            const senderName =
                isTeacher
                    ? 'الشيخ'
                    : 'ولي الأمر';


            const time =
                formatMessageTime(
                    message.createdAt
                );


            messageElement.innerHTML = `

                <div>
                    ${escapeHtml(text)}
                </div>

                <div class="chat-message-meta">

                    <span>
                        ${senderName}
                    </span>

                    <span>
                        ${time}
                    </span>

                </div>

            `;


            chatMessages.appendChild(
                messageElement
            );
        }
    );


    scrollChatToBottom();
}


// ============================================================
// 🛡️ حماية HTML
// ============================================================

function escapeHtml(
    value
) {

    return String(value)
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
        )
        .replace(
            /\n/g,
            '<br>'
        );
}


// ============================================================
// 🕐 وقت الرسالة
// ============================================================

function formatMessageTime(
    timestamp
) {

    if (!timestamp) {
        return 'الآن';
    }


    try {

        const date =
            timestamp.toDate
                ? timestamp.toDate()
                : new Date(timestamp);


        return date.toLocaleTimeString(
            'ar-YE',
            {
                hour:
                    '2-digit',

                minute:
                    '2-digit'
            }
        );

    } catch {

        return 'الآن';
    }
}


// ============================================================
// 📜 النزول لآخر الرسائل
// ============================================================

function scrollChatToBottom() {

    if (!chatMessages) {
        return;
    }


    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}


// ============================================================
// 📤 إرسال رسالة
// ============================================================

if (sendChatMessageButton) {

    sendChatMessageButton.addEventListener(
        'click',
        sendParentChatMessage
    );
}


async function sendParentChatMessage() {

    const text =
        cleanText(
            chatMessageInput.value
        );


    if (!text) {
        return;
    }


    const student =
        currentChatStudent ||
        getSelectedStudent();


    const halaqa =
        currentChatHalaqa ||
        getSelectedHalaqa();


    if (!student || !halaqa) {

        showMessage(
            '⚠️ اختر الحلقة والطالب أولاً.'
        );

        return;
    }


    const parentId =
        student.parentId ||
        student.parentUid ||
        student.guardianId ||
        '';


    if (!parentId) {

        showMessage(
            '⚠️ لا يوجد ولي أمر مرتبط بهذا الطالب.'
        );

        return;
    }


    const user =
        auth.currentUser;


    if (!user) {

        showMessage(
            '⚠️ يجب تسجيل دخول المدرس أولاً.'
        );

        return;
    }


    sendChatMessageButton.disabled =
        true;


    try {

        await addDoc(

            collection(
                db,
                'messages'
            ),

            {

                /*
                 * هوية الطالب
                 */

                studentId:
                    student.id,

                studentName:
                    student.name || '',


                /*
                 * هوية الحلقة
                 */

                halaqaId:
                    halaqa.id,

                halaqaName:
                    halaqa.name || '',


                /*
                 * ولي الأمر
                 */

                parentId,


                /*
                 * المدرس
                 */

                teacherId:
                    halaqa.teacherId ||
                    halaqa.teacherUid ||
                    user.uid,

                teacherName:
                    halaqa.teacherName ||
                    '',


                /*
                 * مرسل الرسالة
                 */

                senderId:
                    user.uid,

                senderRole:
                    'teacher',


                /*
                 * محتوى الرسالة
                 */

                text,


                /*
                 * الوقت
                 */

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            }
        );


        chatMessageInput.value =
            '';


        chatMessageInput.style.height =
            'auto';


        scrollChatToBottom();


    } catch (error) {

        console.error(
            'Send Chat Error:',
            error
        );


        showMessage(
            '❌ تعذر إرسال الرسالة.\n\n' +
            error.message
        );


    } finally {

        sendChatMessageButton.disabled =
            false;
    }
}


// ============================================================
// ⌨️ إرسال بالضغط على Enter
// ============================================================

if (chatMessageInput) {

    chatMessageInput.addEventListener(
        'keydown',
        event => {

            if (
                event.key === 'Enter' &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendParentChatMessage();
            }
        }
    );


    chatMessageInput.addEventListener(
        'input',
        () => {

            chatMessageInput.style.height =
                'auto';

            chatMessageInput.style.height =
                Math.min(
                    chatMessageInput.scrollHeight,
                    110
                ) + 'px';
        }
    );
}


// ============================================================
// 🚀 تشغيل
// ============================================================

initializePage();
