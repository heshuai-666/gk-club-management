const state = {
  token: localStorage.getItem('token') || '',
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  meta: null,
  leadership: [],
  tasks: [],
  scores: [],
  leaderboard: [],
  myCourses: [],
  courseBoard: [],
  schedules: [],
  pendingUsers: [],
  resetRequests: [],
  users: [],
  logs: [],
  notifications: [],
  memberSearch: '',
  reviewDialog: null,
};

const API_BASE_URL = (window.APP_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');

const permissionLabels = {
  publishTasks: '发布任务',
  approveMembers: '成员审核',
  manageScores: '加分计分',
  manageSchedules: '排班安排',
  viewAllSchedules: '查看全员课表',
};

const els = {
  loginScreen: document.getElementById('login-screen'),
  appScreen: document.getElementById('app-screen'),
  tabs: document.getElementById('tabs'),
  statsGrid: document.getElementById('stats-grid'),
  userSummary: document.getElementById('user-summary'),
  toast: document.getElementById('toast'),
  leadershipAdminCard: document.getElementById('leadership-admin-card'),
  taskFormCard: document.getElementById('task-form-card'),
  dutyFormCard: document.getElementById('duty-form-card'),
  reviewModal: document.getElementById('review-modal'),
  reviewTitle: document.getElementById('review-title'),
  reviewBody: document.getElementById('review-body'),
  reviewApproveBtn: document.getElementById('review-approve-btn'),
  reviewRejectBtn: document.getElementById('review-reject-btn'),
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

async function api(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '请求失败');
  }
  return data;
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function canPublishTasks() {
  return state.user?.role === 'super_admin' || state.user?.permissions?.publishTasks;
}

function canApproveMembers() {
  return state.user?.role === 'super_admin' || state.user?.permissions?.approveMembers;
}

function canManageScores() {
  return state.user?.role === 'super_admin' || state.user?.permissions?.manageScores;
}

function canDeleteTask(task) {
  if (!task || !state.user) {
    return false;
  }
  return state.user.role === 'super_admin' || (canPublishTasks() && task.createdBy === state.user.id);
}

function canManageSchedules() {
  return state.user?.role === 'super_admin' || state.user?.permissions?.manageSchedules;
}

function canViewAllSchedules() {
  return state.user?.role === 'super_admin' || state.user?.permissions?.viewAllSchedules;
}

function canUseAdminPanel() {
  return state.user?.role === 'super_admin' || canApproveMembers() || canViewAllSchedules();
}

function getMyTotalScore() {
  const leaderboardHit = state.leaderboard.find((item) => item.id === state.user?.id);
  if (leaderboardHit) {
    return Number(leaderboardHit.totalScore || 0);
  }
  return state.scores
    .filter((item) => item.user_id === state.user?.id)
    .reduce((sum, item) => sum + Number(item.points || 0), 0);
}

function getUserDisplayName(user) {
  return user?.profile?.fullName || user?.fullName || user?.displayName || user?.username || '未命名成员';
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }
  const normalized = String(value).trim().replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function formatDateParts(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function formatDateTimeLocal(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function formatDateTime(value) {
  if (!value) {
    return '未设置';
  }
  const parsed = parseDateValue(value);
  return parsed ? formatDateParts(parsed) : value;
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return '';
  }
  const parsed = parseDateValue(value);
  return parsed ? formatDateTimeLocal(parsed) : '';
}

function setDefaultTaskDeadline() {
  const input = document.getElementById('task-deadline');
  if (!input || input.value) {
    return;
  }
  const nextDeadline = new Date();
  nextDeadline.setDate(nextDeadline.getDate() + 1);
  nextDeadline.setHours(18, 0, 0, 0);
  input.value = formatDateTimeLocal(nextDeadline);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tabName);
  });
}

function switchLoginTab(tabName) {
  document.querySelectorAll('.login-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.loginTab === tabName);
  });
  document.querySelectorAll('.login-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.loginPanel === tabName);
  });
}

function renderLogin() {
  els.loginScreen.innerHTML = `
    <div class="login-shell">
      <section class="login-copy">
        <p class="eyebrow">Industrial Automation Contest</p>
        <h1>工控社团管理系统</h1>
        <p>成员注册、任务下发、学分留痕、课表和值班统一在这里处理，注册和密码修改都要经过管理员审核。</p>
      </section>
      <section class="login-form">
        <div class="login-tabs">
          <button class="login-tab active" data-login-tab="login" type="button">登录</button>
          <button class="login-tab" data-login-tab="register" type="button">注册</button>
          <button class="login-tab" data-login-tab="forgot" type="button">忘记密码</button>
        </div>

        <div class="login-panel active" data-login-panel="login">
          <h2>成员登录</h2>
          <form id="login-form" class="stack">
            <input name="username" placeholder="学号" autocomplete="username" required />
            <input name="password" type="password" placeholder="密码" autocomplete="current-password" required />
            <button type="submit" class="primary-btn">进入系统</button>
          </form>
        </div>

        <div class="login-panel" data-login-panel="register">
          <h2>账号注册</h2>
          <p class="form-note">填写学号、姓名、联系方式、部门和密码，提交后由管理员审核。</p>
          <form id="register-form" class="stack">
            <input name="studentId" placeholder="学号" required />
            <input name="fullName" placeholder="姓名" required />
            <input name="phone" placeholder="联系方式" required />
            <select name="department" id="register-department"></select>
            <input name="password" type="password" placeholder="自设密码" required />
            <button type="submit" class="primary-btn">提交注册申请</button>
          </form>
        </div>

        <div class="login-panel" data-login-panel="forgot">
          <h2>忘记密码</h2>
          <p class="form-note">提交学号、姓名、联系方式和新密码，管理员同意后新密码才会生效。</p>
          <form id="forgot-form" class="stack">
            <input name="studentId" placeholder="学号" required />
            <input name="fullName" placeholder="姓名" required />
            <input name="contact" placeholder="联系方式" required />
            <input name="newPassword" type="password" placeholder="新的密码" required />
            <button type="submit" class="primary-btn">提交重置申请</button>
          </form>
        </div>
      </section>
    </div>
  `;

  document.querySelectorAll('.login-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchLoginTab(tab.dataset.loginTab));
  });

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await login(formData.get('username'), formData.get('password'));
  });

  document.getElementById('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          studentId: formData.get('studentId'),
          username: formData.get('studentId'),
          fullName: formData.get('fullName'),
          phone: formData.get('phone'),
          department: formData.get('department'),
          password: formData.get('password'),
        }),
      });
      event.currentTarget.reset();
      switchLoginTab('login');
      showToast('注册申请已提交，等待管理员审核');
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('forgot-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await api('/api/auth/password-reset-request', {
        method: 'POST',
        body: JSON.stringify({
          studentId: formData.get('studentId'),
          fullName: formData.get('fullName'),
          contact: formData.get('contact'),
          newPassword: formData.get('newPassword'),
        }),
      });
      event.currentTarget.reset();
      switchLoginTab('login');
      showToast('密码重置申请已提交');
    } catch (error) {
      showToast(error.message);
    }
  });

  fillLoginDepartments();
}

function fillLoginDepartments() {
  const select = document.getElementById('register-department');
  if (!select || !state.meta) {
    return;
  }
  select.innerHTML = state.meta.departments.map((item) => `<option value="${item}">${item}</option>`).join('');
}

async function login(username, password) {
  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    saveSession(result.token, result.user);
    showToast('登录成功');
    await bootstrapApp();
  } catch (error) {
    showToast(error.message);
  }
}

function renderStats() {
  const cards = [
    ['成员总数', state.users.length || state.pendingUsers.length],
    ['待审核注册', state.pendingUsers.length],
    ['待处理重置', state.resetRequests.filter((item) => item.status === 'pending').length],
    ['进行中任务', state.tasks.filter((task) => task.status === 'open').length],
    ['值班记录', state.schedules.length],
    ['我的累计学分', getMyTotalScore()],
  ];
  els.statsGrid.innerHTML = cards
    .map(([label, value]) => `<article class="stat-card"><div class="label">${label}</div><div class="value">${value}</div></article>`)
    .join('');
}

function renderLeadership() {
  const groups = new Map();
  state.leadership.forEach((post) => {
    if (!groups.has(post.department)) {
      groups.set(post.department, []);
    }
    groups.get(post.department).push(post);
  });

  const publicWrap = document.getElementById('leadership-public-list');
  publicWrap.innerHTML = [...groups.entries()].map(([department, posts]) => `
    <section class="leadership-group">
      <h3 class="leadership-group-title">${department}</h3>
      ${posts.map((post) => `
        <div class="leadership-item">
          <div class="leadership-role">${post.title}</div>
          <h3>${post.displayName || '待设置'}</h3>
        </div>
      `).join('')}
    </section>
  `).join('') || '<p class="muted">暂无公示信息</p>';

  const adminWrap = document.getElementById('leadership-admin-list');
  const canManage = state.user?.role === 'super_admin';
  els.leadershipAdminCard.classList.toggle('hidden', !canManage);
  if (!canManage) {
    return;
  }
  adminWrap.innerHTML = state.leadership.map((post) => `
    <div class="list-item">
      <h3>${post.department} · ${post.title}</h3>
      <div class="stack">
        <input id="leadership-name-${post.id}" value="${post.displayName || ''}" placeholder="填写公示姓名" />
        <div class="inline-actions">
          <button class="primary-btn" type="button" data-action="save-leadership" data-id="${post.id}">保存公示</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderNotifications() {
  const wrap = document.getElementById('notifications-list');
  wrap.innerHTML = state.notifications.length
    ? state.notifications.slice(0, 10).map((item) => `
      <div class="list-item">
        <h3>${item.message}</h3>
        <div class="meta-row">
          <span>${item.event_type}</span>
          <span>${item.status}</span>
          <span>${formatDateTime(item.created_at)}</span>
        </div>
      </div>
    `).join('')
    : '<p class="muted">暂无提醒</p>';
}

function renderTasks() {
  els.taskFormCard.classList.toggle('hidden', !canPublishTasks());
  const wrap = document.getElementById('tasks-list');
  wrap.innerHTML = state.tasks.length
    ? state.tasks.map((task) => `
      <div class="list-item">
        <h3>${task.title}</h3>
        <p>${task.content}</p>
        <div class="meta-row">
          <span>完成时间 ${formatDateTime(task.deadline)}</span>
          <span>${task.credit} 学分</span>
          <span>${task.targetDepartment === 'ALL' ? '全部成员' : task.targetDepartment}</span>
          <span>${task.status === 'open' ? '进行中' : '已结束'}</span>
        </div>
        <div>
          ${(task.signups || []).map((signup) => `<span class="pill">${signup.fullName || signup.username} · ${signup.department}</span>`).join('') || '<span class="muted">暂无报名</span>'}
        </div>
        <div class="inline-actions" style="margin-top:12px;">
          ${task.status === 'open' ? `<button class="secondary-btn" type="button" data-action="signup-task" data-id="${task.id}">报名参与</button>` : ''}
          ${task.status === 'open' && canManageScores() ? `<button class="primary-btn" type="button" data-action="settle-task" data-id="${task.id}">结束并结算</button>` : ''}
          ${canDeleteTask(task) ? `<button class="danger-btn" type="button" data-action="delete-task" data-id="${task.id}">删除任务</button>` : ''}
        </div>
      </div>
    `).join('')
    : '<p class="muted">暂无任务</p>';
}

function renderScores() {
  document.getElementById('leaderboard-list').innerHTML = `
    <div class="list-item">
      <h3>${getUserDisplayName(state.user)}</h3>
      <div class="meta-row">
        <span>${state.user?.department || '未分配部门'}</span>
        <span>${getMyTotalScore()} 分</span>
      </div>
    </div>
  `;

  document.getElementById('score-records-list').innerHTML = state.scores.length
    ? state.scores.map((item) => `
      <div class="list-item">
        <h3>${item.username} +${item.points}</h3>
        <p>${item.reason}</p>
        <div class="meta-row">
          <span>${item.department || '未分配部门'}</span>
          <span>${item.score_type}</span>
          <span>${formatDateTime(item.created_at)}</span>
        </div>
      </div>
    `).join('')
    : '<p class="muted">暂无学分记录</p>';
}

function renderCourses() {
  document.getElementById('my-courses-list').innerHTML = state.myCourses.length
    ? state.myCourses.map((item) => `
      <div class="list-item">
        <h3>${item.course_date} · ${state.meta.slots[item.slot_index]}</h3>
        <p>${item.course_name || '未填写课程名'}</p>
        <div class="inline-actions">
          <button class="danger-btn" type="button" data-action="delete-course" data-id="${item.id}">删除</button>
        </div>
      </div>
    `).join('')
    : '<p class="muted">你还没有录入课表</p>';

  if (!canViewAllSchedules()) {
    document.getElementById('course-board-list').innerHTML = '<p class="muted">当前没有查看全员课表权限</p>';
    return;
  }

  document.getElementById('course-board-list').innerHTML = state.courseBoard.length
    ? state.courseBoard.map((item) => `
      <div class="list-item">
        <h3>${item.username} · ${item.department || '未分配部门'}</h3>
        <div class="meta-row">
          <span>${item.course_date}</span>
          <span>${state.meta.slots[item.slot_index]}</span>
        </div>
        <p>${item.course_name || '有课'}</p>
      </div>
    `).join('')
    : '<p class="muted">暂无全员课表</p>';
}

function renderDuties() {
  els.dutyFormCard.classList.toggle('hidden', !canManageSchedules());
  document.getElementById('duties-list').innerHTML = state.schedules.length
    ? state.schedules.map((item) => `
      <div class="list-item">
        <h3>${item.title}</h3>
        <div class="meta-row">
          <span>${item.duty_date}</span>
          <span>${item.slotLabel}</span>
          <span>${item.department_scope === 'ALL' ? '全部成员' : item.department_scope}</span>
        </div>
        <div>
          ${(item.assignments || []).map((assignment) => `<span class="pill">${assignment.username} · ${assignment.department || '未分配部门'}</span>`).join('') || '<span class="muted">暂无排班</span>'}
        </div>
        ${canManageSchedules() ? `
          <div class="inline-actions" style="margin-top:12px;">
            <button class="primary-btn" type="button" data-action="edit-duty" data-id="${item.id}">手动调整人员</button>
          </div>
        ` : ''}
      </div>
    `).join('')
    : '<p class="muted">暂无值班记录</p>';
}

function getFilteredUsers() {
  const keyword = state.memberSearch.trim().toLowerCase();
  if (!keyword) {
    return state.users;
  }
  return state.users.filter((item) => {
    const fullName = String(item.profile?.fullName || '').toLowerCase();
    return item.username.toLowerCase().includes(keyword) || fullName.includes(keyword);
  });
}

function getEditorRole(user) {
  return user.editorRole || user.role;
}

function getEditorPermissions(user) {
  return user.editorPermissions || { ...user.permissions };
}

function renderPermissionLine(user, key) {
  const editorRole = getEditorRole(user);
  const editorPermissions = getEditorPermissions(user);
  const checked = editorPermissions[key] ? 'checked' : '';
  const disabled = editorRole !== 'department_admin' ? 'disabled' : '';
  return `
    <label class="checkbox-line">
      <input type="checkbox" data-action="toggle-permission" data-user-id="${user.id}" data-permission="${key}" ${checked} ${disabled} />
      <span>${permissionLabels[key]}</span>
    </label>
  `;
}

function renderPendingUserList() {
  const wrap = document.getElementById('pending-users-list');
  wrap.innerHTML = state.pendingUsers.length
    ? state.pendingUsers.map((item) => `
      <div class="list-item">
        <h3>${getUserDisplayName(item)}</h3>
        <div class="meta-row">
          <span>学号 ${item.username}</span>
          <span>${item.department || '未选部门'}</span>
          <span>${item.profile.phone || '未填联系方式'}</span>
        </div>
        <div class="inline-actions">
          <button class="primary-btn" type="button" data-action="open-user-review" data-id="${item.id}">进入审核</button>
        </div>
      </div>
    `).join('')
    : '<p class="muted">暂无待审核注册</p>';
}

function renderResetRequestList() {
  const wrap = document.getElementById('reset-requests-list');
  wrap.innerHTML = state.resetRequests.length
    ? state.resetRequests.map((item) => `
      <div class="list-item">
        <h3>${item.full_name}</h3>
        <div class="meta-row">
          <span>学号 ${item.student_id}</span>
          <span>${item.contact}</span>
          <span>${item.status}</span>
        </div>
        ${item.status === 'pending' ? `
          <div class="inline-actions">
            <button class="primary-btn" type="button" data-action="open-reset-review" data-id="${item.id}">进入审核</button>
          </div>
        ` : ''}
      </div>
    `).join('')
    : '<p class="muted">暂无密码重置申请</p>';
}

function renderUsersAdminList() {
  const wrap = document.getElementById('users-admin-list');
  if (!canViewAllSchedules()) {
    wrap.innerHTML = '<p class="muted">当前没有成员管理权限</p>';
    return;
  }

  const users = getFilteredUsers();
  wrap.innerHTML = users.length
    ? users.map((item) => {
      const editorRole = getEditorRole(item);
      return `
        <div class="list-item">
          <h3>${getUserDisplayName(item)}</h3>
          <div class="meta-row">
            <span>学号 ${item.username}</span>
            <span>${item.department || '未分配部门'}</span>
            <span>${item.approvalStatus}</span>
          </div>
          <div class="stack" style="margin-top:12px;">
            <select data-action="change-role" data-id="${item.id}">
              <option value="member" ${editorRole === 'member' ? 'selected' : ''}>普通成员</option>
              <option value="department_admin" ${editorRole === 'department_admin' ? 'selected' : ''}>部门管理员</option>
              <option value="super_admin" ${editorRole === 'super_admin' ? 'selected' : ''}>总管理员</option>
            </select>
            <div class="permission-grid">
              ${Object.keys(permissionLabels).map((key) => renderPermissionLine(item, key)).join('')}
            </div>
            <div class="inline-actions">
              <button class="primary-btn" type="button" data-action="save-role" data-id="${item.id}">保存权限</button>
              ${state.user?.role === 'super_admin' && item.role !== 'super_admin' ? `<button class="danger-btn" type="button" data-action="remove-member" data-id="${item.id}">踢出退部</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('')
    : '<p class="muted">没有匹配到成员</p>';
}

function renderAuditLogs() {
  const wrap = document.getElementById('audit-logs-list');
  wrap.innerHTML = state.logs.length
    ? state.logs.map((item) => `
      <div class="list-item">
        <h3>${item.action}</h3>
        <div class="meta-row">
          <span>${item.actor_username || '系统'}</span>
          <span>${item.target_type}</span>
          <span>${formatDateTime(item.created_at)}</span>
        </div>
      </div>
    `).join('')
    : '<p class="muted">暂无审计日志</p>';
}

function renderAdmin() {
  renderPendingUserList();
  renderResetRequestList();
  renderUsersAdminList();
  renderAuditLogs();
}

function renderReviewModal() {
  if (!state.reviewDialog) {
    els.reviewModal.classList.add('hidden');
    els.reviewModal.setAttribute('aria-hidden', 'true');
    els.reviewBody.innerHTML = '';
    return;
  }

  els.reviewModal.classList.remove('hidden');
  els.reviewModal.setAttribute('aria-hidden', 'false');
  if (state.reviewDialog.type === 'register') {
    const item = state.pendingUsers.find((user) => user.id === state.reviewDialog.id);
    if (!item) {
      closeReviewDialog();
      return;
    }
    els.reviewTitle.textContent = '注册审核';
    els.reviewBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row"><strong>学号</strong>${item.username}</div>
        <div class="detail-row"><strong>姓名</strong>${getUserDisplayName(item)}</div>
        <div class="detail-row"><strong>部门</strong>${item.department || '未选部门'}</div>
        <div class="detail-row"><strong>联系方式</strong>${item.profile.phone || '未填写'}</div>
        <div class="detail-row"><strong>提交时间</strong>${formatDateTime(item.createdAt)}</div>
      </div>
    `;
  } else {
    const item = state.resetRequests.find((request) => request.id === state.reviewDialog.id);
    if (!item) {
      closeReviewDialog();
      return;
    }
    els.reviewTitle.textContent = '密码重置审核';
    els.reviewBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row"><strong>学号</strong>${item.student_id}</div>
        <div class="detail-row"><strong>姓名</strong>${item.full_name}</div>
        <div class="detail-row"><strong>联系方式</strong>${item.contact}</div>
        <div class="detail-row"><strong>申请时间</strong>${formatDateTime(item.created_at)}</div>
      </div>
    `;
  }
}

function closeReviewDialog() {
  state.reviewDialog = null;
  renderReviewModal();
}

function renderApp() {
  els.userSummary.textContent = `${getUserDisplayName(state.user)} · ${state.user.role} · ${state.user.department || '未设置部门'}`;
  renderStats();
  renderLeadership();
  renderNotifications();
  renderTasks();
  renderScores();
  renderCourses();
  renderDuties();
  renderAdmin();
  renderReviewModal();

  const adminTab = document.querySelector('[data-tab="admin"]');
  adminTab.classList.toggle('hidden', !canUseAdminPanel());
  if (!canUseAdminPanel() && document.querySelector('.tab.active')?.dataset.tab === 'admin') {
    switchTab('dashboard');
  }
}

function fillMetaOptions() {
  document.getElementById('task-department').innerHTML = ['ALL', ...state.meta.departments]
    .map((item) => `<option value="${item}">${item === 'ALL' ? '全部成员' : item}</option>`)
    .join('');
  document.getElementById('duty-department').innerHTML = ['ALL', ...state.meta.departments]
    .map((item) => `<option value="${item}">${item === 'ALL' ? '全部成员' : item}</option>`)
    .join('');
  const slotOptions = Object.entries(state.meta.slots)
    .map(([key, value]) => `<option value="${key}">${value}</option>`)
    .join('');
  document.getElementById('course-slot').innerHTML = slotOptions;
  document.getElementById('duty-slot').innerHTML = slotOptions;
  fillLoginDepartments();
  setDefaultTaskDeadline();
}

function decorateEditableUser(user) {
  return {
    ...user,
    editorRole: user.role,
    editorPermissions: { ...user.permissions },
  };
}

async function loadAllData() {
  const requests = [
    api('/api/auth/me'),
    api('/api/leadership'),
    api('/api/tasks'),
    api('/api/scores'),
    api('/api/course-slots'),
    api('/api/duty-schedules'),
    api('/api/notifications'),
  ];

  if (canViewAllSchedules()) {
    requests.push(api('/api/course-slots/board'), api('/api/users'), api('/api/audit-logs'));
  }
  if (canApproveMembers()) {
    requests.push(api('/api/users/pending'), api('/api/password-reset-requests'));
  }

  const results = await Promise.all(requests);
  let cursor = 0;
  state.user = results[cursor++].user;
  localStorage.setItem('user', JSON.stringify(state.user));
  state.leadership = results[cursor++].posts;
  state.tasks = results[cursor++].tasks;
  const scoreData = results[cursor++];
  state.scores = scoreData.records;
  state.leaderboard = scoreData.leaderboard;
  state.myCourses = results[cursor++].slots;
  state.schedules = results[cursor++].schedules;
  state.notifications = results[cursor++].notifications;
  state.courseBoard = [];
  state.users = [];
  state.logs = [];
  state.pendingUsers = [];
  state.resetRequests = [];

  if (canViewAllSchedules()) {
    state.courseBoard = results[cursor++].slots;
    state.users = results[cursor++].users.map(decorateEditableUser);
    state.logs = results[cursor++].logs;
  }
  if (canApproveMembers()) {
    state.pendingUsers = results[cursor++].users;
    state.resetRequests = results[cursor++].requests;
  }
}

async function bootstrapApp() {
  try {
    if (!state.meta) {
      state.meta = await api('/api/meta');
      fillMetaOptions();
    }
    if (!state.token) {
      els.loginScreen.classList.remove('hidden');
      els.appScreen.classList.add('hidden');
      renderLogin();
      return;
    }

    await loadAllData();
    els.loginScreen.classList.add('hidden');
    els.appScreen.classList.remove('hidden');
    renderApp();
  } catch (error) {
    clearSession();
    els.loginScreen.classList.remove('hidden');
    els.appScreen.classList.add('hidden');
    renderLogin();
    showToast(error.message);
  }
}

async function handleTaskSettlement(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task || !task.signups.length) {
    showToast('这个任务还没有报名成员');
    return;
  }
  const sameDayUserIds = [];
  const laterUserIds = [];
  for (const signup of task.signups) {
    const choice = window.prompt(`给 ${signup.fullName || signup.username} 结算：输入 1=当天加分，2=后续加分，0=不计分`, '1');
    if (choice === '1') {
      sameDayUserIds.push(signup.user_id);
    }
    if (choice === '2') {
      laterUserIds.push(signup.user_id);
    }
  }
  await api(`/api/tasks/${taskId}/end`, {
    method: 'POST',
    body: JSON.stringify({ sameDayUserIds, laterUserIds }),
  });
  showToast('任务已结束并结算');
  await bootstrapApp();
}

async function handleDutyEdit(scheduleId) {
  const result = await api(`/api/duty-schedules/${scheduleId}/candidates`);
  if (!result.candidates.length) {
    showToast('没有可调整的空闲成员');
    return;
  }
  const choices = result.candidates
    .map((item, index) => `${index + 1}. ${item.username}（${item.department || '未分配部门'}）`)
    .join('\n');
  const answer = window.prompt(`输入要安排的成员序号，多个用英文逗号分隔：\n${choices}`, '1');
  if (!answer) {
    return;
  }
  const userIds = answer
    .split(',')
    .map((item) => Number(item.trim()) - 1)
    .filter((index) => index >= 0 && index < result.candidates.length)
    .map((index) => result.candidates[index].id);

  await api(`/api/duty-schedules/${scheduleId}/assignments`, {
    method: 'PATCH',
    body: JSON.stringify({ userIds }),
  });
  showToast('值班安排已更新');
  await bootstrapApp();
}

function updateUserEditorRole(userId, role) {
  const target = state.users.find((item) => item.id === userId);
  if (!target) {
    return;
  }
  target.editorRole = role;
  if (role === 'super_admin') {
    target.editorPermissions = {
      publishTasks: true,
      approveMembers: true,
      manageScores: true,
      manageSchedules: true,
      viewAllSchedules: true,
    };
  } else if (role === 'member') {
    target.editorPermissions = {
      publishTasks: false,
      approveMembers: false,
      manageScores: false,
      manageSchedules: false,
      viewAllSchedules: false,
    };
  }
  renderUsersAdminList();
}

function updateUserEditorPermission(userId, key, checked) {
  const target = state.users.find((item) => item.id === userId);
  if (!target) {
    return;
  }
  if (!target.editorPermissions) {
    target.editorPermissions = { ...target.permissions };
  }
  target.editorPermissions[key] = checked;
}

function openReviewDialog(type, id) {
  state.reviewDialog = { type, id };
  renderReviewModal();
}

async function submitReviewDecision(status) {
  if (!state.reviewDialog) {
    return;
  }
  if (state.reviewDialog.type === 'register') {
    await api(`/api/users/${state.reviewDialog.id}/approval`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  } else {
    await api(`/api/password-reset-requests/${state.reviewDialog.id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }
  closeReviewDialog();
  showToast(status === 'approved' ? '审核已通过' : '审核已驳回');
  await bootstrapApp();
}

async function onActionClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) {
    return;
  }

  const { action, id } = target.dataset;
  try {
    if (action === 'signup-task') {
      await api(`/api/tasks/${id}/signup`, { method: 'POST' });
      showToast('报名成功');
      await bootstrapApp();
      return;
    }
    if (action === 'settle-task') {
      await handleTaskSettlement(id);
      return;
    }
    if (action === 'delete-task') {
      const task = state.tasks.find((item) => item.id === id);
      if (!window.confirm(`确认删除任务“${task?.title || ''}”吗？删除后报名和关联学分记录也会一起删除。`)) {
        return;
      }
      await api(`/api/tasks/${id}`, { method: 'DELETE' });
      showToast('任务已删除');
      await bootstrapApp();
      return;
    }
    if (action === 'delete-course') {
      await api(`/api/course-slots/${id}`, { method: 'DELETE' });
      showToast('课表记录已删除');
      await bootstrapApp();
      return;
    }
    if (action === 'open-user-review') {
      openReviewDialog('register', id);
      return;
    }
    if (action === 'open-reset-review') {
      openReviewDialog('reset', id);
      return;
    }
    if (action === 'save-role') {
      const user = state.users.find((item) => item.id === id);
      await api(`/api/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: getEditorRole(user),
          permissions: getEditorPermissions(user),
        }),
      });
      showToast('权限已保存');
      await bootstrapApp();
      return;
    }
    if (action === 'remove-member') {
      const user = state.users.find((item) => item.id === id);
      if (!window.confirm(`确认将 ${getUserDisplayName(user)} 踢出并标记为退部成员吗？`)) {
        return;
      }
      await api(`/api/users/${id}/remove`, { method: 'POST' });
      showToast('成员已踢出并停用');
      await bootstrapApp();
      return;
    }
    if (action === 'edit-duty') {
      await handleDutyEdit(id);
      return;
    }
    if (action === 'save-leadership') {
      const input = document.getElementById(`leadership-name-${id}`);
      await api(`/api/leadership/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: input?.value || '' }),
      });
      showToast('公示信息已保存');
      await bootstrapApp();
      return;
    }
  } catch (error) {
    showToast(error.message);
  }
}

function onActionChange(event) {
  const roleSelect = event.target.closest('[data-action="change-role"]');
  if (roleSelect) {
    updateUserEditorRole(roleSelect.dataset.id, roleSelect.value);
    return;
  }

  const checkbox = event.target.closest('[data-action="toggle-permission"]');
  if (checkbox) {
    updateUserEditorPermission(checkbox.dataset.userId, checkbox.dataset.permission, checkbox.checked);
  }
}

function bindEvents() {
  els.tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (tab && !tab.classList.contains('hidden')) {
      switchTab(tab.dataset.tab);
    }
  });

  document.addEventListener('click', onActionClick);
  document.addEventListener('change', onActionChange);

  document.getElementById('refresh-all').addEventListener('click', async () => {
    await bootstrapApp();
    showToast('数据已刷新');
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearSession();
    closeReviewDialog();
    bootstrapApp();
  });

  document.getElementById('task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: form.get('title'),
          content: form.get('content'),
          deadline: form.get('deadline'),
          credit: Number(form.get('credit')),
          targetDepartment: form.get('targetDepartment'),
        }),
      });
      event.currentTarget.reset();
      setDefaultTaskDeadline();
      showToast('任务已发布');
      await bootstrapApp();
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('course-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = new Date(form.get('courseDate'));
    try {
      await api('/api/course-slots/bulk', {
        method: 'POST',
        body: JSON.stringify({
          slots: [{
            courseDate: form.get('courseDate'),
            weekDay: date.getDay(),
            slotIndex: Number(form.get('slotIndex')),
            courseName: form.get('courseName'),
          }],
        }),
      });
      event.currentTarget.reset();
      showToast('课表已保存');
      await bootstrapApp();
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('duty-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/duty-schedules/generate', {
        method: 'POST',
        body: JSON.stringify({
          title: form.get('title'),
          dutyDate: form.get('dutyDate'),
          slotIndex: Number(form.get('slotIndex')),
          count: Number(form.get('count')),
          departments: form.get('department') === 'ALL' ? [] : [form.get('department')],
          notes: form.get('notes'),
        }),
      });
      event.currentTarget.reset();
      showToast('值班表已生成');
      await bootstrapApp();
    } catch (error) {
      showToast(error.message);
    }
  });

  document.getElementById('member-search').addEventListener('input', (event) => {
    state.memberSearch = event.target.value || '';
    renderUsersAdminList();
  });

  document.getElementById('close-review-modal').addEventListener('click', closeReviewDialog);
  els.reviewApproveBtn.addEventListener('click', async () => {
    try {
      await submitReviewDecision('approved');
    } catch (error) {
      showToast(error.message);
    }
  });
  els.reviewRejectBtn.addEventListener('click', async () => {
    try {
      await submitReviewDecision('rejected');
    } catch (error) {
      showToast(error.message);
    }
  });

  window.addEventListener('beforeunload', (event) => {
    if (!state.reviewDialog) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  });
}

async function init() {
  state.meta = await api('/api/meta');
  fillMetaOptions();
  renderLogin();
  bindEvents();
  if (state.token) {
    await bootstrapApp();
  }
}

init().catch((error) => showToast(error.message));
