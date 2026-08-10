// ============================================================
// 💬 صندوق رسائل أولياء الأمور
// 📄 صفحة المدير
// 👨‍👩‍👦 ولي الأمر ⇄ المدير
// 🚫 لا يوجد مدرس في المحادثة
// 📖 جلب اسم الحلقة عبر halaqaId
// ============================================================

import {
    db,
    auth
} from '../../firebase.js';

import {
    collection,
    query,
    where,
    addDoc,
    onSnapshot,
    serverTimestamp,
    doc,
    getDoc
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

let currentAdminId = null;

// ============================================================
// Cache الحلقات
// ============================================================
//
// key   = halaqaId
// value = اسم الحلقة
//
// حتى لا يتم جلب نفس الحلقة أكثر من مرة.
// ============================================================

const halaqaCache = new Map();

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
// ============================================================
// 📖 جلب اسم الحلقة عبر halaqaId
// ============================================================
// ============================================================

async function getHalaqaNameById(halaqaId) {

    const id =
        cleanText(halaqaId);

    // لا يوجد ID
    if (!id) {
        return 'الحلقة غير محددة';
    }

    // ========================================================
    // موجود في Cache
    // ========================================================

    if (halaqaCache.has(id)) {

        return halaqaCache.get(id);

    }

    try {

        /*
         * ====================================================
         * الحلقات موجودة في:
         *
         * halaqat
         *
         * و halaqaId هو ID الوثيقة.
         * ====================================================
         */

        const halaqaRef =
            doc(
                db,
                'halaqat',
                id
            );

        const halaqaSnapshot =
            await getDoc(
                halaqaRef
            );

        if (!halaqaSnapshot.exists()) {

            halaqaCache.set(
                id,
                'الحلقة غير موجودة'
            );

            return 'الحلقة غير موجودة';
        }

        const data =
            halaqaSnapshot.data();

        /*
         * نحاول دعم أكثر من اسم محتمل
         * لحقل اسم الحلقة.
         */

        const halaqaName =
            cleanText(
                data.halaqaName
            ) ||
            cleanText(
                data.name
            ) ||
            cleanText(
                data.title
            ) ||
            'الحلقة غير محددة';

        halaqaCache.set(
            id,
            halaqaName
        );

        return halaqaName;

    } catch (error) {

        console.error(
            'Get Halaqa Name Error:',
            error
        );

        /*
         * لا نوقف المحادثة بسبب خطأ
         * في جلب اسم الحلقة.
         */

        return 'تعذر جلب الحلقة';

    }

}

// ============================================================
// جلب حلقات جميع المحادثات
// ============================================================

async function loadHalaqaNamesForConversations() {

    /*
     * نجمع IDs بدون تكرار
     */

    const halaqaIds =
        [
            ...new Set(
                conversations
                    .map(
                        conversation =>
                            cleanText(
                                conversation.halaqaId
                            )
                    )
                    .filter(Boolean)
            )
        ];

    if (!halaqaIds.length) {

        return;

    }

    /*
     * جلب الحلقات بالتوازي
     */

    await Promise.all(

        halaqaIds.map(
            id =>
                getHalaqaNameById(id)
        )

    );

    /*
     * بعد اكتمال الجلب
     * نضع الاسم داخل المحادثة.
     */

    conversations.forEach(
        conversation => {

            if (
                conversation.halaqaId
            ) {

                conversation.halaqaName =
                    halaqaCache.get(
                        conversation.halaqaId
                    ) ||
                    'الحلقة غير محددة';

            }

        }
    );

}

// ============================================================
// معرف المحادثة
// ============================================================

function getConversationKey(message) {

    const parentId =
        cleanText(
            message.parentId
        );

    const studentId =
        cleanText(
            message.studentId
        );

    /*
     * المحادثة الأساسية:
     *
     * ولي الأمر + الطالب
     *
     * لا نعتمد على الحلقة.
     */

    if (
        parentId &&
        studentId
    ) {

        return [
            parentId,
            studentId
        ].join('_');

    }

    if (parentId) {

        return parentId;

    }

    const senderId =
        cleanText(
            message.senderId
        );

    if (senderId) {

        return `sender_${senderId}`;

    }

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

            return Number(
                timestamp.seconds
            ) * 1000;

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
// تنسيق وقت المحادثة
// ============================================================

function formatConversationTime(timestamp) {

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
// تحميل صندوق الوارد للمدير
// ============================================================

function subscribeToInbox() {

    if (unsubscribeInbox) {

        unsubscribeInbox();

        unsubscribeInbox = null;

    }

    if (!currentAdminId) {

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
     * المدير يستمع إلى كل الرسائل التي adminId فيها
     * يساوي UID المدير.
     * ========================================================
     */

    const messagesQuery =
        query(
            collection(
                db,
                'messages'
            ),

            where(
                'adminId',
                '==',
                currentAdminId
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
                    'Admin Inbox Listener Error:',
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

async function buildConversations(snapshot) {

    const grouped =
        new Map();

    snapshot.forEach(docSnapshot => {

        const message = {

            id: docSnapshot.id,

            ...docSnapshot.data()

        };

        /*
         * لا نستبعد أي رسالة.
         */

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

        const key =
            getConversationKey(
                message
            );

        let existing =
            grouped.get(key);

        if (!existing) {

            existing = {

                key,

                parentId,

                studentId,

                halaqaId,

                /*
                 * لا نعتمد على halaqaName
                 * القادم من الرسالة.
                 */

                studentName:
                    cleanText(
                        message.studentName
                    ) ||
                    'الطالب',

                halaqaName:
                    'جاري جلب الحلقة...',

                parentName:
                    cleanText(
                        message.parentName
                    ) ||
                    'ولي الأمر',

                adminId:
                    cleanText(
                        message.adminId
                    ) ||
                    currentAdminId,

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

        existing.messageCount++;

        // ====================================================
        // استكمال البيانات
        // ====================================================

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
                existing.studentName ===
                    'الطالب'
            ) &&
            cleanText(
                message.studentName
            )
        ) {

            existing.studentName =
                cleanText(
                    message.studentName
                );

        }

        if (
            (
                !existing.parentName ||
                existing.parentName ===
                    'ولي الأمر'
            ) &&
            cleanText(
                message.parentName
            )
        ) {

            existing.parentName =
                cleanText(
                    message.parentName
                );

        }

        // ====================================================
        // آخر رسالة
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
    // الأحدث أولاً
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

    // ========================================================
    // جلب أسماء الحلقات من halaqaId
    // ========================================================

    await loadHalaqaNamesForConversations();

    // ========================================================
    // العدد
    // ========================================================

    chatCount.textContent =
        conversations.length;

    // ========================================================
    // العرض
    // ========================================================

    renderConversationList();

    /*
     * إذا كانت هناك محادثة مفتوحة
     * نحدث اسم الحلقة أيضًا.
     */

    if (currentConversation) {

        const updated =
            conversations.find(
                conversation =>
                    conversation.key ===
                    currentConversation.key
            );

        if (updated) {

            currentConversation =
                updated;

            updateConversationHeader();

        }

    }

}

// ============================================================
// تحديث رأس المحادثة
// ============================================================

function updateConversationHeader() {

    if (!currentConversation) {

        return;

    }

    chatStudentName.textContent =
        `ولي أمر ${
            currentConversation.studentName ||
            'الطالب'
        }`;

    chatHalaqaName.textContent =
        `👤 ${
            currentConversation.parentName ||
            'ولي الأمر'
        }  •  📖 ${
            currentConversation.halaqaName ||
            'الحلقة غير محددة'
        }`;

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

                        conversation.halaqaId,

                        conversation.lastMessage?.text

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
                            : 'لا توجد رسائل'
                    }

                </strong>

                <small>

                    ${
                        search
                            ? 'لم يتم العثور على رسالة مطابقة للبحث.'
                            : 'لم تصل أي رسالة إلى الإدارة حتى الآن.'
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
                lastMessage?.text !==
                undefined

                    ? String(
                        lastMessage.text
                    )

                    : 'رسالة';

            const isParent =
                lastMessage?.senderRole ===
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

                        📖

                        ${escapeHtml(
                            conversation.halaqaName
                        )}

                    </div>

                    <div class="chat-list-last">

                        ${
                            isParent
                                ? '👤'
                                : '👨‍💼'
                        }

                        ${escapeHtml(
                            lastText ||
                                'رسالة'
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
// فتح المحادثة
// ============================================================

async function openConversation(
    conversation
) {

    currentConversation =
        conversation;

    renderConversationList();

    // ========================================================
    // إذا لم يكن اسم الحلقة موجودًا
    // نجلبها مباشرة عبر halaqaId
    // ========================================================

    if (
        currentConversation.halaqaId
    ) {

        currentConversation.halaqaName =
            await getHalaqaNameById(
                currentConversation.halaqaId
            );

    }

    // ========================================================
    // تحديث الرأس
    // ========================================================

    updateConversationHeader();

    chatMessageInput.disabled =
        false;

    sendChatMessageButton.disabled =
        false;

    chatMessageInput.focus();

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
// الاستماع للمحادثة
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

    if (
        !currentConversation.parentId
    ) {

        renderSingleConversationMessage(
            currentConversation.lastMessage
        );

        return;

    }

    /*
     * ========================================================
     * المحادثة تعتمد على:
     *
     * adminId
     * parentId
     *
     * فقط.
     *
     * لا teacherId
     * لا teacherName
     * ========================================================
     */

    const messagesQuery =
        query(

            collection(
                db,
                'messages'
            ),

            where(
                'adminId',
                '==',
                currentAdminId
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

function renderSingleConversationMessage(
    message
) {

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

function renderMessageElement(
    message
) {

    const senderRole =
        cleanText(
            message.senderRole
        ).toLowerCase();

    const isAdmin =
        senderRole === 'admin';

    const text =
        message.text !== undefined
            ? String(
                message.text
            )
            : '';

    const senderName =
        isAdmin

            ? (
                cleanText(
                    message.adminName
                ) ||
                'المدير'
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
        document.createElement(
            'div'
        );

    messageElement.className =
        `chat-message ${
            isAdmin
                ? 'teacher'
                : 'parent'
        }`;

    messageElement.innerHTML = `

        <div class="chat-sender">

            ${
                isAdmin
                    ? '👨‍💼'
                    : '👤'
            }

            ${escapeHtml(
                senderName
            )}

        </div>

        <div class="chat-text">

            ${
                text
                    ? escapeHtml(
                        text
                    )
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
// إرسال رد المدير
// ============================================================

async function sendAdminMessage() {

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
            '⚠️ يجب تسجيل الدخول أولاً.'
        );

        return;

    }

    if (
        !cleanText(
            currentConversation.parentId
        )
    ) {

        showMessage(
            '⚠️ لا يمكن تحديد ولي الأمر لهذه المحادثة.'
        );

        return;

    }

    sendChatMessageButton.disabled =
        true;

    try {

        // ====================================================
        // نتأكد من جلب اسم الحلقة قبل إرسال الرد
        // ====================================================

        let halaqaName =
            currentConversation.halaqaName;

        if (
            currentConversation.halaqaId
        ) {

            halaqaName =
                await getHalaqaNameById(
                    currentConversation.halaqaId
                );

        }

        await addDoc(

            collection(
                db,
                'messages'
            ),

            {

                // =================================================
                // المحادثة
                // =================================================

                conversationId:

                    `${
                        currentConversation.parentId
                    }_${
                        currentConversation.studentId ||
                        ''
                    }`,

                // =================================================
                // الطالب
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
                // الحلقة
                // =================================================

                halaqaId:

                    cleanText(
                        currentConversation.halaqaId
                    ) || null,

                /*
                 * يتم حفظ الاسم أيضًا في رد المدير
                 * لكن المصدر الأساسي هو halaqaId.
                 */

                halaqaName:

                    halaqaName ||
                    'الحلقة غير محددة',

                // =================================================
                // ولي الأمر
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
                // المدير
                // =================================================

                adminId:

                    currentAdminId,

                adminName:

                    user.displayName ||
                    'المدير',

                // =================================================
                // المرسل والمستقبل
                // =================================================

                senderId:

                    user.uid,

                senderRole:

                    'admin',

                receiverId:

                    cleanText(
                        currentConversation.parentId
                    ),

                receiverRole:

                    'parent',

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
            'Send Admin Message Error:',
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
        sendAdminMessage
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

                sendAdminMessage();

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
// الرجوع
// ============================================================

if (backChatBtn) {

    backChatBtn.addEventListener(
        'click',
        () => {

            window.location.href =
                'index.html';

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

async function initializeAdminChat() {

    try {

        if (!auth.currentUser) {

            showMessage(
                '⚠️ يجب تسجيل الدخول للمدير أولاً.'
            );

            return;

        }

        currentAdminId =
            auth.currentUser.uid;

        subscribeToInbox();

    } catch (error) {

        console.error(
            'Admin Chat Initialization Error:',
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

    initializeAdminChat();

} else if (
    typeof auth.onAuthStateChanged ===
    'function'
) {

    const unsubscribeAuth =
        auth.onAuthStateChanged(
            user => {

                if (user) {

                    unsubscribeAuth?.();

                    initializeAdminChat();

                }

            }
        );

                }
