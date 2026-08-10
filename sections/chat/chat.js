// ============================================================
// 💬 محادثة المدرس وولي الأمر
// 📄 صفحة مستقلة
// ============================================================

import {
    db,
    auth
} from '../../firebase.js';

import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    onSnapshot,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ============================================================
// العناصر
// ============================================================

const backChatBtn =
    document.getElementById(
        'backChatBtn'
    );

const chatStudentName =
    document.getElementById(
        'chatStudentName'
    );

const chatHalaqaName =
    document.getElementById(
        'chatHalaqaName'
    );

const chatMessages =
    document.getElementById(
        'chatMessages'
    );

const chatMessageInput =
    document.getElementById(
        'chatMessageInput'
    );

const sendChatMessageButton =
    document.getElementById(
        'sendChatMessageBtn'
    );


// ============================================================
// المتغيرات
// ============================================================

let currentStudent = null;

let currentHalaqa = null;

let currentParentId = null;

let unsubscribeChat = null;


// ============================================================
// الرسائل
// ============================================================

function showMessage(message) {

    alert(message);

}


// ============================================================
// تنظيف النص
// ============================================================

function cleanText(value) {

    return String(
        value || ''
    ).trim();

}


// ============================================================
// قراءة بيانات الرابط
// ============================================================

function getUrlParameters() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    return {

        studentId:
            params.get(
                'studentId'
            ),

        halaqaId:
            params.get(
                'halaqaId'
            )

    };

}


// ============================================================
// حماية HTML
// ============================================================

function escapeHtml(value) {

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
// وقت الرسالة
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
                : new Date(
                    timestamp
                );


        return date.toLocaleTimeString(
            'ar-YE',
            {
                hour: '2-digit',
                minute: '2-digit'
            }
        );


    } catch {

        return 'الآن';

    }

}


// ============================================================
// تحميل الطالب
// ============================================================

async function loadStudent(
    studentId
) {

    const studentRef =
        collection(
            db,
            'students'
        );


    const studentQuery =
        query(
            studentRef,

            where(
                '__name__',
                '==',
                studentId
            )
        );


    const snapshot =
        await getDocs(
            studentQuery
        );


    if (snapshot.empty) {

        throw new Error(
            'الطالب غير موجود.'
        );

    }


    const studentDoc =
        snapshot.docs[0];


    const student = {

        id:
            studentDoc.id,

        ...studentDoc.data()

    };


    return student;

}


// ============================================================
// تحميل الحلقة
// ============================================================

async function loadHalaqa(
    halaqaId
) {

    const halaqaRef =
        collection(
            db,
            'halaqat'
        );


    const halaqaQuery =
        query(
            halaqaRef,

            where(
                '__name__',
                '==',
                halaqaId
            )
        );


    const snapshot =
        await getDocs(
            halaqaQuery
        );


    if (snapshot.empty) {

        throw new Error(
            'الحلقة غير موجودة.'
        );

    }


    const halaqaDoc =
        snapshot.docs[0];


    return {

        id:
            halaqaDoc.id,

        ...halaqaDoc.data()

    };

}


// ============================================================
// تحميل البيانات
// ============================================================

async function initializeChat() {

    try {

        const {
            studentId,
            halaqaId
        } =
            getUrlParameters();


        if (
            !studentId ||
            !halaqaId
        ) {

            throw new Error(
                'بيانات الطالب أو الحلقة غير موجودة في الرابط.'
            );

        }


        // ====================================================
        // المستخدم
        // ====================================================

        if (!auth.currentUser) {

            showMessage(
                '⚠️ يجب تسجيل دخول المدرس أولاً.'
            );

            return;

        }


        // ====================================================
        // تحميل الطالب والحلقة
        // ====================================================

        const [
            student,
            halaqa
        ] =
            await Promise.all([

                loadStudent(
                    studentId
                ),

                loadHalaqa(
                    halaqaId
                )

            ]);


        // ====================================================
        // حماية الطالب غير النشط
        // ====================================================

        if (
            student.isActive === false
        ) {

            throw new Error(
                'هذا الطالب غير نشط.'
            );

        }


        // ====================================================
        // التأكد أن الطالب تابع للحلقة
        // ====================================================

        if (
            student.halaqaId !==
            halaqa.id
        ) {

            throw new Error(
                'الطالب لا يتبع لهذه الحلقة.'
            );

        }


        // ====================================================
        // ولي الأمر
        // ====================================================

        const parentId =
            student.parentId ||
            student.parentUid ||
            student.guardianId ||
            '';


        if (!parentId) {

            throw new Error(
                'لا يوجد حساب ولي أمر مرتبط بهذا الطالب.'
            );

        }


        currentStudent =
            student;


        currentHalaqa =
            halaqa;


        currentParentId =
            parentId;


        // ====================================================
        // عرض البيانات
        // ====================================================

        chatStudentName.textContent =
            `ولي أمر ${student.name || 'الطالب'}`;


        chatHalaqaName.textContent =
            `📖 ${halaqa.name || 'الحلقة'}`;


        // ====================================================
        // تشغيل المحادثة
        // ====================================================

        subscribeToChat();


    } catch (error) {

        console.error(
            'Chat Initialization Error:',
            error
        );


        chatStudentName.textContent =
            'تعذر تحميل المحادثة';


        chatHalaqaName.textContent =
            '';


        chatMessages.innerHTML = `

            <div class="chat-empty">

                <div class="chat-empty-icon">
                    ❌
                </div>

                <strong>
                    تعذر تحميل المحادثة
                </strong>

                <small>
                    ${escapeHtml(
                        error.message
                    )}
                </small>

            </div>

        `;


        if (chatMessageInput) {
            chatMessageInput.disabled =
                true;
        }


        if (sendChatMessageButton) {
            sendChatMessageButton.disabled =
                true;
        }

    }

}


// ============================================================
// 🔴 الاستماع للمحادثة
// ============================================================

function subscribeToChat() {

    if (unsubscribeChat) {

        unsubscribeChat();

        unsubscribeChat =
            null;

    }


    chatMessages.innerHTML = `

        <div class="chat-loading">

            ⏳ جاري تحميل المحادثة...

        </div>

    `;


    const messagesQuery =
        query(

            collection(
                db,
                'messages'
            ),

            where(
                'halaqaId',
                '==',
                currentHalaqa.id
            ),

            where(
                'studentId',
                '==',
                currentStudent.id
            ),

            where(
                'parentId',
                '==',
                currentParentId
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

                        <div class="chat-empty-icon">
                            ❌
                        </div>

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
// عرض الرسائل
// ============================================================

function renderChatMessages(
    snapshot
) {

    if (snapshot.empty) {

        chatMessages.innerHTML = `

            <div class="chat-empty">

                <div class="chat-empty-icon">
                    💬
                </div>

                <strong>
                    لا توجد رسائل بعد
                </strong>

                <small>
                    يمكنك بدء المحادثة مع ولي الأمر.
                </small>

            </div>

        `;

        return;
    }


    const messages = [];


    snapshot.forEach(
        messageDoc => {

            messages.push({

                id:
                    messageDoc.id,

                ...messageDoc.data()

            });

        }
    );


    // ========================================================
    // ترتيب الرسائل
    // ========================================================

    messages.sort(
        (a, b) => {

            const timeA =
                a.createdAt?.toMillis?.() ||
                0;

            const timeB =
                b.createdAt?.toMillis?.() ||
                0;

            return timeA - timeB;

        }
    );


    chatMessages.innerHTML =
        '';


    messages.forEach(
        message => {

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

                    ? (
                        message.teacherName ||
                        'الشيخ'
                    )

                    : 'ولي الأمر';


            const time =
                formatMessageTime(
                    message.createdAt
                );


            messageElement.innerHTML = `

                <div class="chat-sender">

                    ${
                        isTeacher
                            ? '👨‍🏫'
                            : '👤'
                    }

                    ${escapeHtml(
                        senderName
                    )}

                </div>


                <div class="chat-text">

                    ${escapeHtml(
                        text
                    )}

                </div>


                <div class="chat-message-meta">

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
// النزول لآخر الرسائل
// ============================================================

function scrollChatToBottom() {

    if (!chatMessages) {
        return;
    }


    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


// ============================================================
// إرسال رسالة
// ============================================================

async function sendParentChatMessage() {

    const text =
        cleanText(
            chatMessageInput.value
        );


    if (!text) {
        return;
    }


    if (
        !currentStudent ||
        !currentHalaqa ||
        !currentParentId
    ) {

        showMessage(
            '⚠️ لم يتم تحميل بيانات المحادثة.'
        );

        return;

    }


    if (
        currentStudent.isActive === false
    ) {

        showMessage(
            '⚠️ لا يمكن مراسلة ولي أمر طالب غير نشط.'
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

                studentId:
                    currentStudent.id,

                studentName:
                    currentStudent.name ||
                    '',

                halaqaId:
                    currentHalaqa.id,

                halaqaName:
                    currentHalaqa.name ||
                    '',

                parentId:
                    currentParentId,

                teacherId:
                    currentHalaqa.teacherId ||
                    currentHalaqa.teacherUid ||
                    user.uid,

                teacherName:
                    currentHalaqa.teacherName ||
                    '',

                senderId:
                    user.uid,

                senderRole:
                    'teacher',

                text,

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

        chatMessageInput.focus();

    }

}


// ============================================================
// زر الإرسال
// ============================================================

if (sendChatMessageButton) {

    sendChatMessageButton.addEventListener(
        'click',
        sendParentChatMessage
    );

}


// ============================================================
// Enter للإرسال
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
// زر الرجوع
// ============================================================

if (backChatBtn) {

    backChatBtn.addEventListener(
        'click',
        () => {

            // العودة إلى صفحة الرصد
            window.location.href =
                'halaqat.html';

        }
    );

}


// ============================================================
// 🚀 تشغيل الصفحة
// ============================================================

initializeChat();
