// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAAEzOr8cOwqzSULDv3ebBDmsAimf2OMSU",
  authDomain: "lh-student-portal.firebaseapp.com",
  projectId: "lh-student-portal",
  storageBucket: "lh-student-portal.firebasestorage.app",
  messagingSenderId: "932526577676",
  appId: "1:932526577676:web:b3213dd9a21e6af69a7629"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Helper Functions ---
function escapeHtml(unsafe) {
    return (unsafe || '').toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `message ${type === 'error' ? 'error-message' : 'success'}`;
    setTimeout(() => { 
        if (el) el.textContent = ''; 
    }, 4000);
}

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function logout() {
    localStorage.removeItem('loggedInUserType');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('currentStudent');
    window.location.href = 'index.html';
}

function filterTableByLHID(inputId, tbodyId, colIndex) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const filter = input.value.toUpperCase();
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    const trs = tbody.getElementsByTagName('tr');
    for (let i = 0; i < trs.length; i++) {
        const tds = trs[i].getElementsByTagName('td');
        if (tds.length > colIndex && !tds[0].hasAttribute('colspan')) {
            const td = tds[colIndex];
            if (td) {
                const txtValue = td.textContent || td.innerText;
                trs[i].style.display = (txtValue.toUpperCase().indexOf(filter) > -1) ? "" : "none";
            }       
        }
    }
}

// --- Login Page Logic ---
function switchLoginTab(type) {
    const studentForm = document.getElementById('student-login-form');
    const adminForm = document.getElementById('admin-login-form');
    const tabStudent = document.getElementById('tab-student');
    const tabAdmin = document.getElementById('tab-admin');
    const errorMsg = document.getElementById('login-error');
    
    if (errorMsg) errorMsg.textContent = ''; 

    if (type === 'student') {
        if (studentForm) studentForm.classList.remove('hidden');
        if (adminForm) adminForm.classList.add('hidden');
        if (tabStudent) tabStudent.classList.add('active');
        if (tabAdmin) tabAdmin.classList.remove('active');
    } else {
        if (studentForm) studentForm.classList.add('hidden');
        if (adminForm) adminForm.classList.remove('hidden');
        if (tabStudent) tabStudent.classList.remove('active');
        if (tabAdmin) tabAdmin.classList.add('active');
    }
}

function handleAdminLogin(event) {
    event.preventDefault();
    const idInput = document.getElementById('admin-id').value.trim();
    const passwordInput = document.getElementById('admin-password').value;
    const errorMsg = document.getElementById('login-error');

    const admins = {
        'admin_master': { pass: 'Master@LH2026', role: 'master' },
        'admin_att1': { pass: 'Att@LH2026', role: 'attendance' },
        'admin_att2': { pass: 'Att@LH2026_2', role: 'attendance' }
    };

    if (admins[idInput] && admins[idInput].pass === passwordInput) {
        localStorage.setItem('loggedInUserType', 'admin');
        localStorage.setItem('adminRole', admins[idInput].role);
        window.location.href = 'admin.html';
    } else {
        if (errorMsg) errorMsg.textContent = 'Invalid Admin ID or Password.';
    }
}

async function handleStudentLogin(event) {
    event.preventDefault();
    const lhIdInput = document.getElementById('student-lh-id').value.trim().toUpperCase();
    const passwordInput = document.getElementById('student-password').value;
    const errorMsg = document.getElementById('login-error');
    if (errorMsg) errorMsg.textContent = 'Verifying with Firestore...';

    try {
        const docRef = db.collection('students').doc(lhIdInput);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const student = docSnap.data();
            if (student.password === passwordInput) {
                localStorage.setItem('loggedInUserType', 'student');
                localStorage.setItem('currentStudent', JSON.stringify(student));
                window.location.href = 'student.html';
                return;
            }
        }
        if (errorMsg) errorMsg.textContent = 'Invalid LH ID or Password.';
    } catch (error) {
        console.error("Login error:", error);
        if (errorMsg) errorMsg.textContent = 'Error connecting to database. Please check Firestore rules or network.';
    }
}

// --- Student Account Management (Firestore) ---
async function getStudents() {
    try {
        const snapshot = await db.collection('students').get();
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error getting students: ", error);
        return [];
    }
}

async function saveStudent(student) {
    try {
        await db.collection('students').doc(student.lhId).set(student);
    } catch (error) {
        console.error("Error saving student: ", error);
        throw error;
    }
}

async function handleCreateStudent(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('new-student-name');
    const lhIdInput = document.getElementById('new-student-lh-id');
    const passwordInput = document.getElementById('new-student-password');
    const messageEl = document.getElementById('create-student-message');

    const name = nameInput.value.trim();
    const lhId = lhIdInput.value.trim().toUpperCase();
    const password = passwordInput.value;

    if (!name || !lhId || !password) {
        showMessage(messageEl, 'Please fill in all fields.', 'error');
        return;
    }

    try {
        if (messageEl) {
            messageEl.textContent = 'Checking student ID in Firestore...';
            messageEl.className = 'message';
        }

        const docRef = db.collection('students').doc(lhId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            showMessage(messageEl, 'A student with this LH ID already exists.', 'error');
            return;
        }

        if (messageEl) messageEl.textContent = 'Saving student to Firestore...';

        await saveStudent({ name, lhId, password });

        showMessage(messageEl, 'Student account created successfully!', 'success');
        document.getElementById('create-student-form').reset();
        await renderStudentsTable();
    } catch (error) {
        console.error("Error in handleCreateStudent:", error);
        showMessage(messageEl, 'Failed to save student: ' + error.message, 'error');
    }
}

async function renderStudentsTable() {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Loading data from Firestore...</td></tr>`;

    try {
        const students = await getStudents();
        tbody.innerHTML = '';
        
        if (students.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="3" style="text-align: center; color: var(--text-secondary);">No students registered yet.</td>`;
            tbody.appendChild(row);
            return;
        }

        students.forEach(student => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(student.name)}</td>
                <td>${escapeHtml(student.lhId)}</td>
                <td>
                    <button class="btn-primary" style="padding: 4px 8px; font-size: 12px; margin-right: 8px;" onclick="downloadStudentReport('${escapeHtml(student.lhId)}')">Report (CSV)</button>
                    <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; color: var(--error-color); border-color: var(--error-color);" onclick="deleteStudent('${escapeHtml(student.lhId)}')">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error rendering students:", error);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--error-color);">Failed to load students.</td></tr>`;
    }
}

async function deleteStudent(lhId) {
    if (confirm(`Are you sure you want to delete student (${lhId}) from Firestore?`)) {
        try {
            await db.collection('students').doc(lhId).delete();
            await renderStudentsTable();
        } catch (error) {
            console.error("Error deleting student:", error);
            alert("Failed to delete student from Firestore: " + error.message);
        }
    }
}

// --- Student Profile Logic ---
function renderStudentProfile() {
    const currentStudent = JSON.parse(localStorage.getItem('currentStudent'));
    if (!currentStudent) return;

    const nameEl = document.getElementById('profile-name');
    const lhidEl = document.getElementById('profile-lhid');
    const passEl = document.getElementById('profile-password');

    if (nameEl) nameEl.textContent = currentStudent.name;
    if (lhidEl) lhidEl.textContent = currentStudent.lhId;
    if (passEl) passEl.textContent = currentStudent.password;
}

async function handleChangePassword(event) {
    event.preventDefault();
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;
    const msgEl = document.getElementById('password-message');

    if (newPass !== confirmPass) {
        showMessage(msgEl, "Passwords do not match.", "error");
        return;
    }

    const currentStudent = JSON.parse(localStorage.getItem('currentStudent'));
    if (!currentStudent) return;
    
    try {
        await db.collection('students').doc(currentStudent.lhId).update({
            password: newPass
        });
        
        currentStudent.password = newPass;
        localStorage.setItem('currentStudent', JSON.stringify(currentStudent));
        
        showMessage(msgEl, "Password updated successfully in Firestore!", "success");
        document.getElementById('change-password-form').reset();
        renderStudentProfile();
    } catch (error) {
        console.error("Password update error:", error);
        showMessage(msgEl, "Failed to update password: " + error.message, "error");
    }
}

// --- Mess Out Logic (Firestore) ---
async function getMessOuts() {
    try {
        const snap = await db.collection('messouts').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting messouts: ", error);
        return [];
    }
}

async function saveMessOut(messout) {
    try {
        await db.collection('messouts').add(messout);
    } catch (error) {
        console.error("Error saving messout: ", error);
        throw error;
    }
}

function initializeMessOutPage() {
    renderStudentMessOuts();

    const fromInput = document.getElementById('messout-from');
    const toInput = document.getElementById('messout-to');
    if (fromInput && toInput) {
        const today = new Date();
        const minDate = new Date(today);
        minDate.setDate(today.getDate() + 2); // 2 days in advance
        
        const minDateStr = minDate.toISOString().split('T')[0];
        fromInput.min = minDateStr;

        fromInput.addEventListener('change', (e) => {
            const startDate = new Date(e.target.value);
            toInput.min = e.target.value;
            const maxDate = new Date(startDate);
            maxDate.setDate(startDate.getDate() + 4); // max 5 days total
            toInput.max = maxDate.toISOString().split('T')[0];
        });
    }
}

async function handleApplyMessOut(event) {
    event.preventDefault();
    
    const currentStudent = JSON.parse(localStorage.getItem('currentStudent'));
    if (!currentStudent) return;

    const fromDateStr = document.getElementById('messout-from').value;
    const toDateStr = document.getElementById('messout-to').value;
    const messageEl = document.getElementById('messout-message');

    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);

    if (toDate < fromDate) {
        showMessage(messageEl, 'To Date cannot be before From Date.', 'error');
        return;
    }

    const diffDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 5) {
        showMessage(messageEl, 'Maximum 5 days can be applied at once.', 'error');
        return;
    }

    const minAllowedDate = new Date();
    minAllowedDate.setHours(0,0,0,0);
    minAllowedDate.setDate(minAllowedDate.getDate() + 2);
    if (fromDate < minAllowedDate) {
        showMessage(messageEl, 'Must apply at least 2 days in advance.', 'error');
        return;
    }

    try {
        const allMessOuts = await getMessOuts();
        const studentMessOuts = allMessOuts.filter(m => m.lhId === currentStudent.lhId);
        
        const hasActive = studentMessOuts.some(m => new Date(m.toDate) >= today);
        if (hasActive) {
            showMessage(messageEl, 'You already have an active or future mess out. Please wait until it completes.', 'error');
            return;
        }

        await saveMessOut({
            name: currentStudent.name,
            lhId: currentStudent.lhId,
            fromDate: fromDateStr,
            toDate: toDateStr,
            status: 'Applied'
        });

        showMessage(messageEl, 'Mess out applied successfully in Firestore!', 'success');
        document.getElementById('messout-form').reset();
        await renderStudentMessOuts();
    } catch (err) {
        console.error("Error applying messout:", err);
        showMessage(messageEl, 'Failed to apply mess out: ' + err.message, 'error');
    }
}

async function renderStudentMessOuts() {
    const tbody = document.getElementById('student-messout-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading mess outs from Firestore...</td></tr>';

    const currentStudent = JSON.parse(localStorage.getItem('currentStudent'));
    if (!currentStudent) return;

    const allMessOuts = await getMessOuts();
    tbody.innerHTML = '';
    const studentMessOuts = allMessOuts.filter(m => m.lhId === currentStudent.lhId).sort((a,b) => new Date(b.fromDate) - new Date(a.fromDate));

    if (studentMessOuts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No mess outs found.</td></tr>`;
        return;
    }

    studentMessOuts.forEach(m => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(m.fromDate)}</td>
            <td>${escapeHtml(m.toDate)}</td>
            <td><span style="background: #e2e8f0; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${escapeHtml(m.status)}</span></td>
            <td><button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; color: var(--error-color); border-color: var(--error-color);" onclick="deleteMessOut('${m.id}')">Delete</button></td>
        `;
        tbody.appendChild(row);
    });
}

async function renderAdminMessOuts() {
    const tbody = document.getElementById('admin-messouts-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading mess outs from Firestore...</td></tr>';

    const allMessOuts = (await getMessOuts()).sort((a,b) => new Date(b.fromDate) - new Date(a.fromDate));
    tbody.innerHTML = '';
    
    if (allMessOuts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No mess outs applied yet.</td></tr>`;
        return;
    }

    allMessOuts.forEach(m => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(m.name)}</td>
            <td>${escapeHtml(m.lhId)}</td>
            <td>${escapeHtml(m.fromDate)}</td>
            <td>${escapeHtml(m.toDate)}</td>
            <td><button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; color: var(--error-color); border-color: var(--error-color);" onclick="deleteMessOut('${m.id}')">Delete</button></td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteMessOut(id) {
    if (confirm('Are you sure you want to delete this mess out from Firestore?')) {
        try {
            await db.collection('messouts').doc(id).delete();
            if (document.getElementById('student-messout-body')) {
                await renderStudentMessOuts();
            }
            if (document.getElementById('admin-messouts-body')) {
                await renderAdminMessOuts();
            }
        } catch (error) {
            console.error("Error deleting mess out:", error);
            alert("Failed to delete mess out: " + error.message);
        }
    }
}

// --- Extras Logic (Firestore) ---
async function getExtraItems() {
    try {
        const snap = await db.collection('extraItems').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch(e) { 
        console.error("Error getting extra items: ", e);
        return []; 
    }
}

async function getStudentExtras() {
    try {
        const snap = await db.collection('studentExtras').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch(e) { 
        console.error("Error getting student extras: ", e);
        return []; 
    }
}

async function handleAddExtraItem(event) {
    event.preventDefault();
    const name = document.getElementById('extra-name').value.trim();
    const category = document.getElementById('extra-category').value.trim();
    const rate = document.getElementById('extra-rate').value.trim();
    const msgEl = document.getElementById('add-extra-message');

    try {
        await db.collection('extraItems').add({ name, category, rate });
        showMessage(msgEl, 'Extra item added successfully to Firestore!', 'success');
        document.getElementById('create-extra-form').reset();
        await renderAdminExtras();
    } catch (e) {
        console.error("Error adding extra item:", e);
        showMessage(msgEl, 'Failed to add item: ' + e.message, 'error');
    }
}

async function takeExtraItem(itemId, itemName, itemRate) {
    const currentStudent = JSON.parse(localStorage.getItem('currentStudent'));
    if (!currentStudent) return;

    if (confirm(`Are you sure you want to take ${itemName} for ₹${itemRate}?`)) {
        try {
            await db.collection('studentExtras').add({
                studentLhId: currentStudent.lhId,
                studentName: currentStudent.name,
                itemId,
                itemName,
                itemRate,
                dateTaken: new Date().toISOString()
            });
            
            const msgEl = document.getElementById('extras-message');
            if (msgEl) showMessage(msgEl, `${itemName} added to your account!`, 'success');
            
            await renderStudentExtrasPage();
        } catch (e) {
            console.error("Error taking extra:", e);
            alert("Failed to take extra: " + e.message);
        }
    }
}

async function renderAdminExtras() {
    const availableTbody = document.getElementById('admin-available-extras-body');
    const studentTbody = document.getElementById('admin-student-extras-body');

    if (availableTbody) {
        availableTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading items...</td></tr>`;
        const items = await getExtraItems();
        availableTbody.innerHTML = '';
        if (items.length === 0) {
            availableTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No items added yet.</td></tr>`;
        } else {
            items.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.category)}</td>
                    <td>₹${escapeHtml(item.rate)}</td>
                    <td><button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; color: var(--error-color); border-color: var(--error-color);" onclick="deleteExtraItem('${item.id}')">Delete</button></td>
                `;
                availableTbody.appendChild(row);
            });
        }
    }

    if (studentTbody) {
        studentTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Loading summary...</td></tr>`;
        const studentExtras = await getStudentExtras();
        const students = await getStudents();
        studentTbody.innerHTML = '';
        
        if (students.length === 0) {
            studentTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-secondary);">No students registered.</td></tr>`;
        } else {
            students.forEach(student => {
                const count = studentExtras.filter(e => e.studentLhId === student.lhId).length;
                const row = document.createElement('tr');
                row.innerHTML = `<td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.lhId)}</td><td>${count}</td>`;
                studentTbody.appendChild(row);
            });
        }
    }
}

async function renderStudentExtrasPage() {
    const availableTbody = document.getElementById('student-available-extras-body');
    const takenTbody = document.getElementById('student-taken-extras-body');
    
    if (availableTbody) {
        availableTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading items...</td></tr>`;
        const items = await getExtraItems();
        availableTbody.innerHTML = '';
        if (items.length === 0) {
            availableTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No extras available.</td></tr>`;
        } else {
            items.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.category)}</td>
                    <td>₹${escapeHtml(item.rate)}</td>
                    <td><button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; color: var(--primary-color); border-color: var(--primary-color);" onclick="takeExtraItem('${item.id}', '${escapeHtml(item.name)}', '${item.rate}')">Take</button></td>
                `;
                availableTbody.appendChild(row);
            });
        }
    }

    if (takenTbody) {
        const currentStudent = JSON.parse(localStorage.getItem('currentStudent'));
        if (!currentStudent) return;

        takenTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading your extras...</td></tr>`;
        const allExtras = await getStudentExtras();
        const myExtras = allExtras.filter(e => e.studentLhId === currentStudent.lhId).sort((a,b) => new Date(b.dateTaken) - new Date(a.dateTaken));
        takenTbody.innerHTML = '';
        if (myExtras.length === 0) {
            takenTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">You haven't taken any extras yet.</td></tr>`;
        } else {
            const now = Date.now();
            myExtras.forEach(e => {
                const takenTime = new Date(e.dateTaken).getTime();
                const canDelete = (now - takenTime) <= 3600000; // 1 hour window
                const displayDate = e.dateTaken.includes('T') ? new Date(e.dateTaken).toLocaleString() : e.dateTaken;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${escapeHtml(e.itemName)}</td>
                    <td>₹${escapeHtml(e.itemRate)}</td>
                    <td>${escapeHtml(displayDate)}</td>
                    <td>${canDelete ? `<button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; color: var(--error-color); border-color: var(--error-color);" onclick="deleteStudentExtra('${e.id}')">Delete</button>` : '<span style="font-size: 12px; color: var(--text-secondary);">Expired</span>'}</td>
                `;
                takenTbody.appendChild(row);
            });
        }
    }
}

async function deleteExtraItem(id) {
    if (confirm('Are you sure you want to delete this available item from Firestore?')) {
        try {
            await db.collection('extraItems').doc(id).delete();
            await renderAdminExtras();
        } catch (e) {
            alert("Error deleting item: " + e.message);
        }
    }
}

async function deleteStudentExtra(id) {
    if (confirm('Are you sure you want to remove this extra from your account in Firestore?')) {
        try {
            await db.collection('studentExtras').doc(id).delete();
            await renderStudentExtrasPage();
        } catch (e) {
            alert("Error deleting extra: " + e.message);
        }
    }
}

// --- Attendance Logic (Firestore) ---
async function getAttendance(date) {
    try {
        const doc = await db.collection('attendance').doc(date).get();
        return doc.exists ? doc.data() : {};
    } catch(e) {
        console.error("Error getting attendance:", e);
        return {};
    }
}

async function saveAttendance(date, data) {
    try {
        await db.collection('attendance').doc(date).set(data);
    } catch (e) {
        console.error("Error saving attendance:", e);
    }
}

async function toggleAttendance(studentId, meal) {
    const date = getTodayDateString();
    const data = await getAttendance(date);
    if (!data[studentId]) {
        data[studentId] = { breakfast: false, lunch: false, tea: false, dinner: false };
    }
    data[studentId][meal] = !data[studentId][meal];
    await saveAttendance(date, data);
}

async function renderAttendanceTable() {
    const tbody = document.getElementById('admin-attendance-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading attendance from Firestore...</td></tr>';

    const students = await getStudents();
    const allMessOuts = await getMessOuts();
    const date = getTodayDateString();
    
    const todayObj = new Date(date);
    todayObj.setHours(0,0,0,0);
    
    const attendanceData = await getAttendance(date);

    const dateDisplay = document.getElementById('attendance-date-display');
    if (dateDisplay) dateDisplay.textContent = date;

    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No students registered yet.</td></tr>`;
        return;
    }

    students.forEach(student => {
        let isMessOut = false;
        allMessOuts.forEach(m => {
            if (m.lhId === student.lhId) {
                const fromD = new Date(m.fromDate);
                const toD = new Date(m.toDate);
                fromD.setHours(0,0,0,0);
                toD.setHours(0,0,0,0);
                
                if (todayObj >= fromD && todayObj <= toD) {
                    isMessOut = true;
                }
            }
        });

        const att = attendanceData[student.lhId] || { breakfast: false, lunch: false, tea: false, dinner: false };

        const row = document.createElement('tr');
        if (isMessOut) {
            row.style.backgroundColor = '#fef2f2';
        }

        row.innerHTML = `
            <td>${escapeHtml(student.name)}</td>
            <td>${escapeHtml(student.lhId)}</td>
            <td style="text-align:center;"><input type="checkbox" ${att.breakfast ? 'checked' : ''} ${isMessOut ? 'disabled' : ''} onchange="toggleAttendance('${escapeHtml(student.lhId)}', 'breakfast')"></td>
            <td style="text-align:center;"><input type="checkbox" ${att.lunch ? 'checked' : ''} ${isMessOut ? 'disabled' : ''} onchange="toggleAttendance('${escapeHtml(student.lhId)}', 'lunch')"></td>
            <td style="text-align:center;"><input type="checkbox" ${att.tea ? 'checked' : ''} ${isMessOut ? 'disabled' : ''} onchange="toggleAttendance('${escapeHtml(student.lhId)}', 'tea')"></td>
            <td style="text-align:center;"><input type="checkbox" ${att.dinner ? 'checked' : ''} ${isMessOut ? 'disabled' : ''} onchange="toggleAttendance('${escapeHtml(student.lhId)}', 'dinner')"></td>
            <td>${isMessOut ? '<span style="color: var(--error-color); font-weight: 600; font-size: 13px;">Mess Out</span>' : '<span style="color: var(--success-color); font-size: 13px;">Present</span>'}</td>
        `;
        tbody.appendChild(row);
    });
}

// --- Reports Logic (Firestore) ---
async function downloadAttendanceCSV(event) {
    event.preventDefault();

    const fromDateStr = document.getElementById('report-from').value;
    const toDateStr = document.getElementById('report-to').value;

    const periodStart = new Date(fromDateStr);
    const periodEnd = new Date(toDateStr);
    periodStart.setHours(0,0,0,0);
    periodEnd.setHours(0,0,0,0);

    if (periodEnd < periodStart) {
        alert('To Date cannot be before From Date.');
        return;
    }

    const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;
    const students = await getStudents();
    const allMessOuts = await getMessOuts();

    let csvContent = "Student Name,LH ID,Total Days in Period,Mess Out Days,Present Days\n";

    students.forEach(student => {
        let messOutDays = 0;
        const studentMessOuts = allMessOuts.filter(m => m.lhId === student.lhId);
        
        studentMessOuts.forEach(m => {
            const mStart = new Date(m.fromDate);
            const mEnd = new Date(m.toDate);
            mStart.setHours(0,0,0,0);
            mEnd.setHours(0,0,0,0);

            const overlapStart = new Date(Math.max(periodStart, mStart));
            const overlapEnd = new Date(Math.min(periodEnd, mEnd));

            if (overlapStart <= overlapEnd) {
                const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
                messOutDays += overlapDays;
            }
        });

        const presentDays = Math.max(0, totalDays - messOutDays);
        const name = `"${student.name.replace(/"/g, '""')}"`;
        const lhId = `"${student.lhId.replace(/"/g, '""')}"`;

        csvContent += `${name},${lhId},${totalDays},${messOutDays},${presentDays}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_Report_${fromDateStr}_to_${toDateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function downloadStudentReport(lhId) {
    const students = await getStudents();
    const student = students.find(s => s.lhId === lhId);
    if (!student) return;

    let csvContent = `Detailed Report for ${student.name} (${student.lhId})\n\n`;

    // 1. Mess Out Records
    csvContent += `--- MESS OUT RECORDS ---\n`;
    csvContent += `From Date,To Date,Status\n`;
    const messOuts = (await getMessOuts()).filter(m => m.lhId === lhId);
    if (messOuts.length === 0) {
        csvContent += `No records found\n`;
    } else {
        messOuts.forEach(m => {
            csvContent += `${m.fromDate},${m.toDate},${m.status}\n`;
        });
    }
    csvContent += `\n`;

    // 2. Extras Records
    csvContent += `--- EXTRAS TAKEN ---\n`;
    csvContent += `Item Name,Rate,Date Taken\n`;
    const extras = (await getStudentExtras()).filter(e => e.studentLhId === lhId);
    if (extras.length === 0) {
        csvContent += `No records found\n`;
    } else {
        extras.forEach(e => {
            const displayDate = e.dateTaken.includes('T') ? new Date(e.dateTaken).toLocaleString().replace(/,/g, '') : e.dateTaken;
            csvContent += `${e.itemName},${e.itemRate},${displayDate}\n`;
        });
    }
    csvContent += `\n`;

    // 3. Daily Attendance from Firestore
    csvContent += `--- DAILY ATTENDANCE ---\n`;
    csvContent += `Date,Breakfast,Lunch,Tea,Dinner\n`;
    let attFound = false;
    try {
        const attSnap = await db.collection('attendance').get();
        attSnap.docs.forEach(doc => {
            const dateStr = doc.id;
            const data = doc.data();
            if (data[lhId]) {
                attFound = true;
                const att = data[lhId];
                csvContent += `${dateStr},${att.breakfast ? 'Yes':'No'},${att.lunch ? 'Yes':'No'},${att.tea ? 'Yes':'No'},${att.dinner ? 'Yes':'No'}\n`;
            }
        });
    } catch (err) {
        console.error("Error fetching attendance for student report:", err);
    }
    if (!attFound) csvContent += `No attendance records found\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Detailed_Report_${student.lhId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
