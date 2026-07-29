import { db, loadHalaqatList } from '../../firebase.js';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const halaqaFilter = document.getElementById('halaqaFilter');
const studentSelect = document.getElementById('studentIdSelect');
const attendanceStatus = document.getElementById('attendanceStatus');
const recitationFields = document.getElementById('recitationFields');
const halaqat = await loadHalaqatList();

halaqaFilter.innerHTML = '<option value="">اختر الحلقة...</option>';
halaqat.forEach(h => { halaqaFilter.innerHTML += `<option value="${h.id}">${h.name} - (الشيخ: ${h.teacherName})</option>`; });

halaqaFilter.addEventListener('change', async () => {
    const selectedHalaqa = halaqaFilter.value;
    if (!selectedHalaqa) return;
    const q = query(collection(db, "students"), where("halaqaId", "==", selectedHalaqa));
    const snap = await getDocs(q);
    studentSelect.innerHTML = '<option value="">اختر الطالب...</option>';
    snap.forEach(doc => studentSelect.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`);
});

attendanceStatus.addEventListener('change', () => {
    const status = attendanceStatus.value;
    recitationFields.style.display = (status === 'حاضر') ? 'block' : 'none';
    document.getElementById('pointsGiven').value = (status === 'حاضر') ? "10" : "0";
});

document.getElementById('saveRecitationBtn').addEventListener('click', async () => {
    const studentId = studentSelect.value;
    const halaqaId = halaqaFilter.value;
    const status = attendanceStatus.value;
    if (!studentId || !halaqaId) return alert("يرجى اختيار الحلقة والطالب");
    const surah = document.getElementById('currentSurah').value.trim();
    const fromAya = document.getElementById('fromAya').value;
    const toAya = document.getElementById('toAya').value;
    const tomorrowReq = document.getElementById('tomorrowReq').value.trim();
    const notes = document.getElementById('teacherNotes').value.trim();
    const points = parseInt(document.getElementById('pointsGiven').value) || 0;
    if (status === "حاضر" && !surah) return alert("يرجى إدخال اسم السورة");
    const evaluations = [];
    document.querySelectorAll('.eval-check:checked').forEach(cb => evaluations.push(cb.value));
    const grade = evaluations.length > 0 ? evaluations[0] : (status === "حاضر" ? "جيد" : "-");
    let teacherPhone = "967770000000";
    const halaqaDoc = halaqat.find(h => h.id === halaqaId);
    if (halaqaDoc?.teacherPhone) teacherPhone = halaqaDoc.teacherPhone;
    try {
        await addDoc(collection(db, "records"), {
            studentId, status, surah: status === "حاضر" ? surah : status,
            fromAyah: fromAya || "0", toAyah: toAya || "0", grade,
            tomorrowRequirement: tomorrowReq || "لا يوجد", notes: notes || "", teacherPhone,
            pointsGiven: points, date: new Date().toISOString().split('T')[0], timestamp: serverTimestamp()
        });
        if (status === "حاضر" && points > 0) {
            await updateDoc(doc(db, "students", studentId), { totalPoints: increment(points) });
        }
        alert(`✅ تم تحديث سجل الطالب\n📊 النقاط: ${points}`);
        document.getElementById('currentSurah').value = '';
        document.getElementById('fromAya').value = '';
        document.getElementById('toAya').value = '';
        document.getElementById('tomorrowReq').value = '';
        document.getElementById('teacherNotes').value = '';
        document.getElementById('pointsGiven').value = "10";
        document.querySelectorAll('.eval-check').forEach(c => c.checked = false);
    } catch (e) { alert("خطأ: " + e.message); }
});