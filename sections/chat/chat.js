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
    document.getElementById('chatPage');

const backChatBtn =
    document.getElementById('backChatBtn');

const mobileBackChatBtn =
    document.getElementById('mobileBackChatBtn');

const chatList =
    document.getElementById('chatList');

const chatCount =
    document.getElementById('chatCount');

const chatSearch =
    document.getElementById('chatSearch');

const chatStudentName =
    document.getElementById('chatStudentName');

const chatHalaqaName =
    document.getElementById('chatHalaqaName');

const chatMessages =
    document.getElementById('chatMessages');

const chatMessageInput =
    document.getElementById('chatMessageInput');

const sendChatMessageButton =
    document.getElementById('sendChatMessageBtn');


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

    return String(value ?? '').trim();

}


// ============================================================
// حماية HTML
// ============================================================

function escapeHtml(value) {

    return String(value ?? '')

        .replace(/&/g, '&amp;')

        .replace(/</g, '&lt;')

        .replace(/>/g, '&gt;')

        .replace(/"/g, '&quot;')

        .replace(/'/g, '&#039;');

}


// ============================================================
// معرف المحادثة
// ============================================================

function getConversationKey(message) {

    const parentId =
        cleanText(message.parentId);

    const studentId =
        cleanText(message.studentId);

    const halaqaId =
        cleanText(message.halaqaId);


    /*
     * الأولوية:
     *
     * ولي الأمر + الطالب + الحلقة
     *
     * وإذا كانت بيانات الطالب أو الحلقة ناقصة:
     *
     * ولي الأمر فقط
     *
     * حتى لا تختفي الرسالة.
     */

    if (parentId && studentId && halaqaId) {

        return [
            parentId,
            studentId,
            halaqaId
        ].join('_');

    }


    if (parentId && studentId) {

        return [
            parentId,
            studentId
        ].join('_');

    }


    if (parentId) {

        return parentId;

    }


    /*
     * في حال الرسالة لا تحتوي parentId
     * نستخدم senderId كحل أخير.
     *
     * ولكن الرد لن يكون ممكناً إلا إذا
     * كان parentId موجوداً في إحدى رسائل
     * نفس المحادثة.
     */

    const senderId =
        cleanText(message.senderId);


    if (senderId) {

        return `sender_${senderId}`;

    }


    /*
     * لا نحذف الرسالة.
     * نعطيها معرفاً خاصاً.
     */

    return `message_${message.id || Date.now()}`;

}


// ============================================================
// وقت الرسالة
// ============================================================

function getTimestampMillis(timestamp) {

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
            timestamp.seconds !== undefined
        ) {

            return Number(timestamp.seconds) * 1000;

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
// تنسيق وقت الرسالة
// ============================================================

function formatMessageTime(timestamp) {

    const millis =
        getTimestampMillis(timestamp);


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
// تنسيق وقت المحادثة
// ============================================================

function formatConversationTime(timestamp) {

    const millis =
        getTimestampMillis(timestamp);


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
// الحرف الأول
// ============================================================

function getInitial(name) {

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

        unsubscribeInbox = null;

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


    /*
     * ========================================================
     * مهم جداً:
     *
     * نبحث فقط عن teacherId.
     *
     * لا نشترط parentId
     * ولا studentId
     * ولا halaqaId.
     *
     * لذلك أي رسالة وصلت لهذا المدرس
     * سيتم التقاطها.
     * ========================================================
     */

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

                buildConversations(snapshot);

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
                            ${escapeHtml(
                                error.message
                            )}
                        </small>

                    </div>

                `;

            }

        );

}


// ============================================================
// بناء المحادثات
// ============================================================

function buildConversations(snapshot) {

    const grouped =
        new Map();


    snapshot.forEach(doc => {

        const message = {

            id: doc.id,

            ...doc.data()

        };


        /*
         * ====================================================
         * لا يوجد هنا:
         *
         * if (!parentId || !studentId || !halaqaId) return;
         *
         * لأننا نريد عرض الرسالة مهما كانت بياناتها.
         * ====================================================
         */

        const parentId =
            cleanText(message.parentId);

        const studentId =
            cleanText(message.studentId);

        const halaqaId =
            cleanText(message.halaqaId);


        const key =
            getConversationKey(message);


        let existing =
            grouped.get(key);


        if (!existing) {

            existing = {

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
                    ) ||
                    currentTeacherId,

                teacherName:
                    cleanText(
                        message.teacherName
                    ) ||
                    'المدرس',

                lastMessage:
                    message,

                messageCount:
                    1

            };


            grouped.set(
                key,
                existing
            );


            return;

        }


        // ====================================================
        // تحديث بيانات المحادثة
        // ====================================================

        existing.messageCount++;


        /*
         * إذا كانت بيانات سابقة ناقصة
         * وأتت رسالة جديدة فيها البيانات،
         * نستخدم البيانات الجديدة.
         */

        if (
            !existing.parentId &&
            parentId
        ) {

            existing.parentId =
                parentId;

        }


        if (
            !existing.studentId &&
            studentId
        ) {

            existing.studentId =
                studentId;

        }


        if (
            !existing.halaqaId &&
            halaqaId
        ) {

            existing.halaqaId =
                halaqaId;

        }


        if (
            (
                !existing.studentName ||
                existing.studentName === 'الطالب'
            ) &&
            cleanText(message.studentName)
        ) {

            existing.studentName =
                cleanText(
                    message.studentName
                );

        }


        if (
            (
                !existing.halaqaName ||
                existing.halaqaName === 'الحلقة'
            ) &&
            cleanText(message.halaqaName)
        ) {

            existing.halaqaName =
                cleanText(
                    message.halaqaName
                );

        }


        if (
            (
                !existing.parentName ||
                existing.parentName === 'ولي الأمر'
            ) &&
            cleanText(message.parentName)
        ) {

            existing.parentName =
                cleanText(
                    message.parentName
                );

        }


        if (
            !existing.teacherName &&
            cleanText(message.teacherName)
        ) {

            existing.teacherName =
                cleanText(
                    message.teacherName
                );

        }


        // ====================================================
        // تحديد آخر رسالة
        // ====================================================

        const currentTime =
            getTimestampMillis(
                message.createdAt
            );


        const oldTime =
            getTimestampMillis(
                existing.lastMessage?.createdAt
            );


        if (
            currentTime >= oldTime
        ) {

            existing.lastMessage =
                message;

        }

    });


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
                    a.lastMessage?.createdAt
                );


            const timeB =
                getTimestampMillis(
                    b.lastMessage?.createdAt
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

                        conversation.lastMessage?.text

                    ]

                        .join(' ')
                        .toLowerCase();


                    return text.includes(search);

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
                            : 'لا توجد رسائل'
                    }

                </strong>

                <small>

                    ${
                        search
                            ? 'لم يتم العثور على رسالة مطابقة للبحث.'
                            : 'لم تصل أي رسالة إلى هذا المدرس حتى الآن.'
                    }

                </small>

            </div>

        `;

        return;

    }


    chatList.innerHTML = '';


    filtered.forEach(
        conversation => {

            const item =
                document.createElement('div');


            item.className =
                'chat-list-item';


            if (
                currentConversation &&
                currentConversation.key ===
                    conversation.key
            ) {

                item.classList.add('active');

            }


            const lastMessage =
                conversation.lastMessage;


            /*
             * حتى لو كانت الرسالة بدون text
             * لا نخفيها.
             */

            const lastText =
                lastMessage?.text !== undefined
                    ? String(lastMessage.text)
                    : 'رسالة';


            const isParent =
                lastMessage?.senderRole === 'parent' ||
                lastMessage?.senderRole === 'guardian' ||
                lastMessage?.senderRole === 'user' ||
                lastMessage?.senderRole === 'ولي الأمر';


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

                        <div class="chat-list-parent">

                            ${escapeHtml(
                                conversation.parentName
                            )}

                        </div>


                        <div class="chat-list-time">

                            ${formatConversationTime(
                                lastMessage?.createdAt
                            )}

                        </div>

                    </div>


                    <div class="chat-list-student">

                        👤

                        ${escapeHtml(
                            conversation.studentName
                        )}

                        ·

                        ${escapeHtml(
                            conversation.halaqaName
                        )}

                    </div>


                    <div class="chat-list-last">

                        ${
                            isParent
                                ? '👤 '
                                : '👨‍🏫 '
                        }

                        ${escapeHtml(
                            lastText || 'رسالة'
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


            chatList.appendChild(item);

        }
    );

}


// ============================================================
// فتح المحادثة
// ============================================================

function openConversation(conversation) {

    currentConversation =
        conversation;


    renderConversationList();


    // ========================================================
    // بيانات الرأس
    // ========================================================

    chatStudentName.textContent =
        `ولي أمر ${conversation.studentName || 'الطالب'}`;


    chatHalaqaName.textContent =

        `👤 ${
            conversation.parentName ||
            'ولي الأمر'
        }  •  📖 ${
            conversation.halaqaName ||
            'الحلقة'
        }`;


    // ========================================================
    // تفعيل الإدخال
    // ========================================================

    chatMessageInput.disabled =
        false;


    sendChatMessageButton.disabled =
        false;


    chatMessageInput.focus();


    // ========================================================
    // الهاتف
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
// الاستماع إلى المحادثة
// ============================================================

function subscribeToConversation() {

    if (unsubscribeChat) {

        unsubscribeChat();

        unsubscribeChat = null;

    }


    if (!currentConversation) {
        return;
    }


    chatMessages.innerHTML = `

        <div class="chat-loading">

            ⏳ جاري تحميل الرسائل...

        </div>

    `;


    /*
     * ========================================================
     * مهم:
     *
     * سابقاً كان الاستعلام يشترط:
     *
     * teacherId
     * parentId
     * studentId
     * halaqaId
     *
     * وهذا يجعل بعض الرسائل تختفي.
     *
     * الآن نستخدم:
     *
     * teacherId + parentId
     *
     * فقط.
     *
     * وبالتالي تظهر كل رسائل ولي الأمر
     * مع المدرس حتى لو كانت رسالة معينة
     * ناقصة studentId أو halaqaId.
     * ========================================================
     */

    if (!currentConversation.parentId) {

        /*
         * إذا كانت الرسالة فعلاً لا تحتوي
         * parentId، لا نستطيع معرفة صاحبها
         * بشكل آمن للرد عليه.
         *
         * لكننا لا نخفي الرسالة.
         */

        renderSingleConversationMessage(
            currentConversation.lastMessage
        );

        return;

    }


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
                            ${escapeHtml(
                                error.message
                            )}
                        </small>

                    </div>

                `;

            }

        );

}


// ============================================================
// عرض رسالة منفردة
// ============================================================

function renderSingleConversationMessage(message) {

    if (!message) {

        chatMessages.innerHTML = `

            <div class="chat-empty">

                <div class="chat-empty-icon">
                    💬
                </div>

                <strong>
                    لا توجد رسائل
                </strong>

            </div>

        `;

        return;

    }


    chatMessages.innerHTML = '';


    renderMessageElement(
        message
    );

}


// ============================================================
// عرض الرسائل
// ============================================================

function renderChatMessages(snapshot) {

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


    snapshot.forEach(doc => {

        messages.push({

            id: doc.id,

            ...doc.data()

        });

    });


    messages.sort(
        (a, b) => {

            return (

                getTimestampMillis(
                    a.createdAt
                )

                -

                getTimestampMillis(
                    b.createdAt
                )

            );

        }
    );


    chatMessages.innerHTML = '';


    messages.forEach(
        message => {

            renderMessageElement(
                message
            );

        }
    );


    scrollChatToBottom();

}


// ============================================================
// إنشاء عنصر الرسالة
// ============================================================

function renderMessageElement(message) {

    const senderRole =
        cleanText(
            message.senderRole
        ).toLowerCase();


    const isTeacher =
        senderRole === 'teacher' ||
        senderRole === 'admin' ||
        senderRole === 'مدرس';


    const text =
        message.text !== undefined
            ? String(message.text)
            : '';


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
                    message.parentName
                ) ||

                cleanText(
                    currentConversation?.parentName
                ) ||

                'ولي الأمر'
            );


    const time =
        formatMessageTime(
            message.createdAt
        );


    const messageElement =
        document.createElement('div');


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

            ${
                text
                    ? escapeHtml(text)
                    : '<span style="opacity:.6">رسالة بدون نص</span>'
            }

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
// إرسال رد المدرس
// ============================================================

async function sendTeacherMessage() {

    const text =
        cleanText(
            chatMessageInput.value
        );


    /*
     * الرسالة يجب أن تحتوي نصاً عند الإرسال.
     */

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


    /*
     * ========================================================
     * لا يمكن إرسال رد لولي الأمر إذا لم نعرف parentId.
     *
     * هذه الحالة لا يمكن حلها من جهة المدرس،
     * لأن Firestore لا يخبرنا من هو المستلم.
     * ========================================================
     */

    if (
        !cleanText(
            currentConversation.parentId
        )
    ) {

        showMessage(
            '⚠️ هذه الرسالة لا تحتوي على معرف ولي الأمر (parentId)، لذلك لا يمكن إرسال رد آمن عليها.'
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

                // =================================================
                // بيانات الطالب
                // =================================================

                studentId:
                    cleanText(
                        currentConversation.studentId
                    ) || null,

                studentName:
                    cleanText(
                        currentConversation.studentName
                    ) ||
                    'الطالب',


                // =================================================
                // بيانات الحلقة
                // =================================================

                halaqaId:
                    cleanText(
                        currentConversation.halaqaId
                    ) || null,

                halaqaName:
                    cleanText(
                        currentConversation.halaqaName
                    ) ||
                    'الحلقة',


                // =================================================
                // بيانات ولي الأمر
                // =================================================

                parentId:
                    cleanText(
                        currentConversation.parentId
                    ),

                parentName:
                    cleanText(
                        currentConversation.parentName
                    ) ||
                    'ولي الأمر',


                // =================================================
                // بيانات المدرس
                // =================================================

                teacherId:
                    currentTeacherId,

                teacherName:
                    cleanText(
                        currentConversation.teacherName
                    ) ||
                    user.displayName ||
                    'المدرس',


                // =================================================
                // المرسل
                // =================================================

                senderId:
                    user.uid,

                senderRole:
                    'teacher',


                // =================================================
                // الرسالة
                // =================================================

                text,


                // =================================================
                // الوقت
                // =================================================

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
// الرجوع في الجوال
// ============================================================

function closeMobileConversation() {

    if (unsubscribeChat) {

        unsubscribeChat();

        unsubscribeChat = null;

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
        renderConversationList
    );

}


// ============================================================
// إرسال
// ============================================================

if (sendChatMessageButton) {

    sendChatMessageButton.addEventListener(
        'click',
        sendTeacherMessage
    );

}


// ============================================================
// Enter
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
// الرجوع للصفحة السابقة
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
// رجوع الجوال
// ============================================================

if (mobileBackChatBtn) {

    mobileBackChatBtn.addEventListener(
        'click',
        closeMobileConversation
    );

}


// ============================================================
// تنظيف Listeners
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

        if (!auth.currentUser) {

            showMessage(
                '⚠️ يجب تسجيل دخول المدرس أولاً.'
            );

            return;

        }


        currentTeacherId =
            auth.currentUser.uid;


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
// انتظار تسجيل الدخول
// ============================================================

if (auth.currentUser) {

    initializeChatInbox();

} else if (
    typeof auth.onAuthStateChanged === 'function'
) {

    const unsubscribeAuth =
        auth.onAuthStateChanged(
            user => {

                if (user) {

                    unsubscribeAuth?.();

                    initializeChatInbox();

                }

            }
        );

        }
