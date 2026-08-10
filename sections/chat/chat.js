// ============================================================
// 💬 صندوق رسائل أولياء الأمور
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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ============================================================
// العناصر
// ============================================================

const chatPage =
    document.getElementById(
        'chatPage'
    );

const backChatBtn =
    document.getElementById(
        'backChatBtn'
    );

const mobileBackChatBtn =
    document.getElementById(
        'mobileBackChatBtn'
    );

const chatList =
    document.getElementById(
        'chatList'
    );

const chatCount =
    document.getElementById(
        'chatCount'
    );

const chatSearch =
    document.getElementById(
        'chatSearch'
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

let conversations = [];

let currentConversation = null;

let unsubscribeInbox = null;

let unsubscribeChat = null;

let currentTeacherId = null;


// ============================================================
// رسالة
// ============================================================

function showMessage(message) {

    alert(message);

}


// ============================================================
// تنظيف النص
// ============================================================

function cleanText(value) {

    return String(
        value ?? ''
    ).trim();

}


// ============================================================
// حماية HTML
// ============================================================

function escapeHtml(value) {

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
// معرف المحادثة
// ============================================================

function getConversationKey(
    message
) {

    return [

        cleanText(
            message.parentId
        ),

        cleanText(
            message.studentId
        ),

        cleanText(
            message.halaqaId
        )

    ].join('_');

}


// ============================================================
// وقت الرسالة
// ============================================================

function getTimestampMillis(
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


        if (
            timestamp.seconds
        ) {

            return (
                timestamp.seconds *
                1000
            );

        }


        const date =
            new Date(timestamp);


        const time =
            date.getTime();


        return Number.isNaN(time)
            ? 0
            : time;

    } catch {

        return 0;

    }

}


// ============================================================
// تنسيق الوقت
// ============================================================

function formatMessageTime(
    timestamp
) {

    const millis =
        getTimestampMillis(
            timestamp
        );


    if (!millis) {
        return 'الآن';
    }


    try {

        const date =
            new Date(millis);


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
// تنسيق تاريخ القائمة
// ============================================================

function formatConversationTime(
    timestamp
) {

    const millis =
        getTimestampMillis(
            timestamp
        );


    if (!millis) {
        return 'الآن';
    }


    try {

        const date =
            new Date(millis);

        const now =
            new Date();


        const sameDay =
            date.getFullYear() ===
                now.getFullYear() &&

            date.getMonth() ===
                now.getMonth() &&

            date.getDate() ===
                now.getDate();


        if (sameDay) {

            return date.toLocaleTimeString(
                'ar-YE',
                {
                    hour: '2-digit',
                    minute: '2-digit'
                }
            );

        }


        return date.toLocaleDateString(
            'ar-YE',
            {
                day: 'numeric',
                month: 'short'
            }
        );

    } catch {

        return '';

    }

}


// ============================================================
// الحرف الأول للاسم
// ============================================================

function getInitial(
    name
) {

    const value =
        cleanText(name);


    if (!value) {
        return '👤';
    }


    return value.charAt(0);

}


// ============================================================
// تحميل صندوق الوارد
// ============================================================

function subscribeToInbox() {

    if (unsubscribeInbox) {

        unsubscribeInbox();

        unsubscribeInbox =
            null;

    }


    if (!currentTeacherId) {
        return;
    }


    chatList.innerHTML = `

        <div class="chat-list-empty">

            <div class="chat-list-empty-icon">
                ⏳
            </div>

            <strong>
                جاري تحميل المحادثات...
            </strong>

        </div>

    `;


    // ========================================================
    // جميع الرسائل الخاصة بالمدرس
    // ========================================================

    const messagesQuery =
        query(

            collection(
                db,
                'messages'
            ),

            where(
                'teacherId',
                '==',
                currentTeacherId
            )

        );


    unsubscribeInbox =
        onSnapshot(

            messagesQuery,

            snapshot => {

                buildConversations(
                    snapshot
                );

            },

            error => {

                console.error(
                    'Inbox Listener Error:',
                    error
                );


                chatList.innerHTML = `

                    <div class="chat-list-empty">

                        <div class="chat-list-empty-icon">
                            ❌
                        </div>

                        <strong>
                            تعذر تحميل المحادثات
                        </strong>

                        <small>
                            تحقق من صلاحيات Firestore.
                        </small>

                    </div>

                `;

            }

        );

}


// ============================================================
// بناء المحادثات
// ============================================================

function buildConversations(
    snapshot
) {

    const grouped =
        new Map();


    snapshot.forEach(
        doc => {

            const message = {

                id:
                    doc.id,

                ...doc.data()

            };


            const parentId =
                cleanText(
                    message.parentId
                );

            const studentId =
                cleanText(
                    message.studentId
                );

            const halaqaId =
                cleanText(
                    message.halaqaId
                );


            // =================================================
            // تجاهل الرسائل غير المرتبطة
            // =================================================

            if (
                !parentId ||
                !studentId ||
                !halaqaId
            ) {

                return;

            }


            const key =
                getConversationKey(
                    message
                );


            const existing =
                grouped.get(key);


            if (!existing) {

                grouped.set(
                    key,
                    {

                        key,

                        parentId,

                        studentId,

                        halaqaId,

                        studentName:
                            cleanText(
                                message.studentName
                            ) ||
                            'الطالب',

                        halaqaName:
                            cleanText(
                                message.halaqaName
                            ) ||
                            'الحلقة',

                        parentName:
                            cleanText(
                                message.parentName
                            ) ||
                            'ولي الأمر',

                        teacherId:
                            cleanText(
                                message.teacherId
                            ),

                        teacherName:
                            cleanText(
                                message.teacherName
                            ) ||
                            'المدرس',

                        lastMessage:
                            message,

                        messageCount:
                            1

                    }
                );

            } else {

                existing.messageCount++;


                const currentTime =
                    getTimestampMillis(
                        message.createdAt
                    );


                const oldTime =
                    getTimestampMillis(
                        existing
                            .lastMessage
                            ?.createdAt
                    );


                if (
                    currentTime >=
                    oldTime
                ) {

                    existing.lastMessage =
                        message;

                }


                // =============================================
                // تحديث البيانات إذا كانت موجودة
                // =============================================

                if (
                    !existing.studentName &&
                    message.studentName
                ) {

                    existing.studentName =
                        message.studentName;

                }


                if (
                    existing.halaqaName ===
                        'الحلقة' &&
                    message.halaqaName
                ) {

                    existing.halaqaName =
                        message.halaqaName;

                }


                if (
                    existing.parentName ===
                        'ولي الأمر' &&
                    message.parentName
                ) {

                    existing.parentName =
                        message.parentName;

                }

            }

        }
    );


    conversations =
        Array.from(
            grouped.values()
        );


    // ========================================================
    // ترتيب الأحدث أولاً
    // ========================================================

    conversations.sort(
        (a, b) => {

            const timeA =
                getTimestampMillis(
                    a.lastMessage
                        ?.createdAt
                );


            const timeB =
                getTimestampMillis(
                    b.lastMessage
                        ?.createdAt
                );


            return timeB - timeA;

        }
    );


    chatCount.textContent =
        conversations.length;


    renderConversationList();

}


// ============================================================
// عرض قائمة المحادثات
// ============================================================

function renderConversationList() {

    const search =
        cleanText(
            chatSearch?.value
        ).toLowerCase();


    let filtered =
        conversations;


    if (search) {

        filtered =
            conversations.filter(
                conversation => {

                    const text = [

                        conversation.parentName,

                        conversation.studentName,

                        conversation.halaqaName,

                        conversation.lastMessage
                            ?.text

                    ]

                        .join(' ')
                        .toLowerCase();


                    return text.includes(
                        search
                    );

                }
            );

    }


    if (!filtered.length) {

        chatList.innerHTML = `

            <div class="chat-list-empty">

                <div class="chat-list-empty-icon">
                    ${
                        search
                            ? '🔎'
                            : '💬'
                    }
                </div>

                <strong>
                    ${
                        search
                            ? 'لا توجد نتائج'
                            : 'لا توجد محادثات'
                    }
                </strong>

                <small>
                    ${
                        search
                            ? 'لم يتم العثور على محادثة مطابقة للبحث.'
                            : 'لم يرسل أي ولي أمر رسالة حتى الآن.'
                    }
                </small>

            </div>

        `;

        return;

    }


    chatList.innerHTML =
        '';


    filtered.forEach(
        conversation => {

            const item =
                document.createElement(
                    'div'
                );


            item.className =
                'chat-list-item';


            if (
                currentConversation &&
                currentConversation.key ===
                    conversation.key
            ) {

                item.classList.add(
                    'active'
                );

            }


            const lastMessage =
                conversation.lastMessage;


            const lastText =
                cleanText(
                    lastMessage?.text
                ) ||
                'لا توجد رسالة';


            const isParent =
                lastMessage
                    ?.senderRole ===
                'parent';


            item.innerHTML = `

                <div class="chat-list-avatar">

                    ${escapeHtml(
                        getInitial(
                            conversation.parentName
                        )
                    )}

                </div>


                <div class="chat-list-content">

                    <div class="chat-list-name-row">

                        <div
                            class="chat-list-parent"
                        >
                            ${escapeHtml(
                                conversation.parentName
                            )}
                        </div>


                        <div
                            class="chat-list-time"
                        >
                            ${formatConversationTime(
                                lastMessage?.createdAt
                            )}
                        </div>

                    </div>


                    <div
                        class="chat-list-student"
                    >
                        👤
                        ${escapeHtml(
                            conversation.studentName
                        )}
                        ·
                        ${escapeHtml(
                            conversation.halaqaName
                        )}
                    </div>


                    <div
                        class="chat-list-last"
                    >
                        ${
                            isParent
                                ? '👤 '
                                : '👨‍🏫 '
                        }

                        ${escapeHtml(
                            lastText
                        )}
                    </div>

                </div>


                ${
                    isParent
                        ? `
                            <div
                                class="chat-unread"
                                title="آخر رسالة من ولي الأمر"
                            >
                                ●
                            </div>
                        `
                        : ''
                }

            `;


            item.addEventListener(
                'click',
                () => {

                    openConversation(
                        conversation
                    );

                }
            );


            chatList.appendChild(
                item
            );

        }
    );

}


// ============================================================
// فتح محادثة
// ============================================================

function openConversation(
    conversation
) {

    currentConversation =
        conversation;


    renderConversationList();


    // ========================================================
    // بيانات الرأس
    // ========================================================

    chatStudentName.textContent =
        `ولي أمر ${conversation.studentName}`;


    chatHalaqaName.textContent =
        `👤 ${conversation.parentName}  •  📖 ${conversation.halaqaName}`;


    // ========================================================
    // تفعيل الإدخال
    // ========================================================

    chatMessageInput.disabled =
        false;


    sendChatMessageButton.disabled =
        false;


    chatMessageInput.focus();


    // ========================================================
    // على الهاتف افتح المحادثة
    // ========================================================

    if (
        window.innerWidth <= 750
    ) {

        chatPage.classList.add(
            'mobile-conversation'
        );

    }


    subscribeToConversation();

}


// ============================================================
// الاستماع إلى المحادثة الحالية
// ============================================================

function subscribeToConversation() {

    if (unsubscribeChat) {

        unsubscribeChat();

        unsubscribeChat =
            null;

    }


    if (!currentConversation) {
        return;
    }


    chatMessages.innerHTML = `

        <div class="chat-loading">

            ⏳ جاري تحميل الرسائل...

        </div>

    `;


    const messagesQuery =
        query(

            collection(
                db,
                'messages'
            ),

            where(
                'teacherId',
                '==',
                currentTeacherId
            ),

            where(
                'parentId',
                '==',
                currentConversation.parentId
            ),

            where(
                'studentId',
                '==',
                currentConversation.studentId
            ),

            where(
                'halaqaId',
                '==',
                currentConversation.halaqaId
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
                    'Conversation Listener Error:',
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
                            تحقق من صلاحيات Firestore.
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
        doc => {

            messages.push({

                id:
                    doc.id,

                ...doc.data()

            });

        }
    );


    messages.sort(
        (a, b) => {

            return (
                getTimestampMillis(
                    a.createdAt
                ) -
                getTimestampMillis(
                    b.createdAt
                )
            );

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


            const text =
                cleanText(
                    message.text
                );


            const senderName =
                isTeacher

                    ? (
                        cleanText(
                            message.teacherName
                        ) ||
                        'المدرس'
                    )

                    : (
                        cleanText(
                            currentConversation
                                ?.parentName
                        ) ||
                        'ولي الأمر'
                    );


            const time =
                formatMessageTime(
                    message.createdAt
                );


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


    requestAnimationFrame(
        () => {

            chatMessages.scrollTop =
                chatMessages.scrollHeight;

        }
    );

}


// ============================================================
// إرسال رسالة للولي
// ============================================================

async function sendTeacherMessage() {

    const text =
        cleanText(
            chatMessageInput.value
        );


    if (!text) {
        return;
    }


    if (!currentConversation) {

        showMessage(
            '⚠️ اختر محادثة أولاً.'
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
                    currentConversation
                        .studentId,

                studentName:
                    currentConversation
                        .studentName,

                halaqaId:
                    currentConversation
                        .halaqaId,

                halaqaName:
                    currentConversation
                        .halaqaName,

                parentId:
                    currentConversation
                        .parentId,

                teacherId:
                    currentTeacherId,

                teacherName:
                    currentConversation
                        .teacherName ||
                    user.displayName ||
                    'المدرس',

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
// الرجوع من المحادثة في الجوال
// ============================================================

function closeMobileConversation() {

    if (unsubscribeChat) {

        unsubscribeChat();

        unsubscribeChat =
            null;

    }


    currentConversation =
        null;


    chatPage.classList.remove(
        'mobile-conversation'
    );


    chatStudentName.textContent =
        'اختر محادثة';


    chatHalaqaName.textContent =
        'ستظهر تفاصيل الطالب والحلقة هنا';


    chatMessageInput.value =
        '';


    chatMessageInput.disabled =
        true;


    sendChatMessageButton.disabled =
        true;


    chatMessages.innerHTML = `

        <div class="no-conversation">

            <div class="no-conversation-icon">
                💬
            </div>

            <strong>
                اختر محادثة
            </strong>

            <small>
                اضغط على أحد أولياء الأمور لعرض الرسائل والرد عليه.
            </small>

        </div>

    `;


    renderConversationList();

}


// ============================================================
// البحث
// ============================================================

if (chatSearch) {

    chatSearch.addEventListener(
        'input',
        () => {

            renderConversationList();

        }
    );

}


// ============================================================
// زر إرسال
// ============================================================

if (sendChatMessageButton) {

    sendChatMessageButton.addEventListener(
        'click',
        sendTeacherMessage
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

                sendTeacherMessage();

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
                    115
                ) + 'px';

        }
    );

}


// ============================================================
// رجوع الصفحة
// ============================================================

if (backChatBtn) {

    backChatBtn.addEventListener(
        'click',
        () => {

            window.location.href =
                'halaqat.html';

        }
    );

}


// ============================================================
// رجوع المحادثة في الجوال
// ============================================================

if (mobileBackChatBtn) {

    mobileBackChatBtn.addEventListener(
        'click',
        closeMobileConversation
    );

}


// ============================================================
// إغلاق Listener عند مغادرة الصفحة
// ============================================================

window.addEventListener(
    'beforeunload',
    () => {

        if (unsubscribeInbox) {

            unsubscribeInbox();

        }


        if (unsubscribeChat) {

            unsubscribeChat();

        }

    }
);


// ============================================================
// تشغيل الصفحة
// ============================================================

async function initializeChatInbox() {

    try {

        // ====================================================
        // انتظار تسجيل الدخول
        // ====================================================

        if (!auth.currentUser) {

            showMessage(
                '⚠️ يجب تسجيل دخول المدرس أولاً.'
            );

            return;

        }


        currentTeacherId =
            auth.currentUser.uid;


        // ====================================================
        // تشغيل صندوق الوارد
        // ====================================================

        subscribeToInbox();

    } catch (error) {

        console.error(
            'Chat Inbox Initialization Error:',
            error
        );


        chatList.innerHTML = `

            <div class="chat-list-empty">

                <div class="chat-list-empty-icon">
                    ❌
                </div>

                <strong>
                    تعذر تحميل الرسائل
                </strong>

                <small>
                    ${escapeHtml(
                        error.message
                    )}
                </small>

            </div>

        `;

    }

}


// ============================================================
// تشغيل بعد جاهزية Firebase Auth
// ============================================================

if (
    auth.currentUser
) {

    initializeChatInbox();

} else {

    const unsubscribeAuth =
        auth.onAuthStateChanged
            ? auth.onAuthStateChanged(
                user => {

                    if (user) {

                        unsubscribeAuth?.();

                        initializeChatInbox();

                    }

                }
            )
            : null;

}
