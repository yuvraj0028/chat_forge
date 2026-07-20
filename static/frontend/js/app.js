const Toast = {
  show(msg, type = 'info') {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
};

const Confirm = {
  show(msg) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <p>${msg}</p>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" id="confirm-no">Cancel</button>
            <button class="btn btn-primary btn-sm" id="confirm-yes">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));
      const close = (val) => { overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 200); resolve(val); };
      overlay.querySelector('#confirm-no').onclick = () => close(false);
      overlay.querySelector('#confirm-yes').onclick = () => close(true);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    });
  },
};

const App = {
  state: { view: 'auth', user: null, projects: [], project: null, conversations: [], conversation: null },

  init() {
    if (API.token()) { this.loadProfile().then(() => this.route('dashboard')); }
    else { this.route('auth'); }
    window.addEventListener('hashchange', () => this.onHashChange());
  },

  route(view, params = {}) {
    Object.assign(this.state, params);
    this.state.view = view;
    const root = document.getElementById('root');
    switch (view) {
      case 'auth': this.renderAuth(root); break;
      case 'dashboard': this.renderDashboard(root); break;
      case 'project': this.renderProjectDetail(root); break;
      case 'chat': this.renderChat(root); break;
      case 'settings': this.renderSettings(root); break;
      default: this.renderDashboard(root);
    }
  },

  // ─── Auth ────────────────────────────────────────────────────
  renderAuth(root) {
    root.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-logo">
            <div class="logo-icon">⚡</div>
            <h1>ChatForge</h1>
            <p>Build and chat with custom AI agents</p>
          </div>
          <div class="auth-tabs">
            <button class="auth-tab active" onclick="App.switchAuthTab('login')">Sign In</button>
            <button class="auth-tab" onclick="App.switchAuthTab('register')">Sign Up</button>
          </div>
          <div id="auth-error"></div>
          <form id="auth-form" onsubmit="App.handleAuth(event)">
            <div id="auth-fields"></div>
          </form>
        </div>
      </div>`;
    this.switchAuthTab('login');
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((t, i) => {
      t.classList.toggle('active', (tab === 'login' ? i === 0 : i === 1));
    });
    const fields = document.getElementById('auth-fields');
    if (tab === 'login') {
      fields.innerHTML = `
        <div class="form-group">
          <label>Email</label>
          <input class="form-input" type="email" name="email" placeholder="you@example.com" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input class="form-input" type="password" name="password" placeholder="Your password" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit" id="auth-btn">Sign In</button>`;
    } else {
      fields.innerHTML = `
        <div class="form-row">
          <div class="form-group">
            <label>First Name</label>
            <input class="form-input" type="text" name="first_name" placeholder="First">
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input class="form-input" type="text" name="last_name" placeholder="Last">
          </div>
        </div>
        <div class="form-group">
          <label>Username</label>
          <input class="form-input" type="text" name="username" placeholder="Choose a username" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="form-input" type="email" name="email" placeholder="you@example.com" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input class="form-input" type="password" name="password" placeholder="Min 8 characters" required>
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input class="form-input" type="password" name="password2" placeholder="Repeat password" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit" id="auth-btn">Create Account</button>`;
    }
    document.getElementById('auth-error').innerHTML = '';
  },

  async handleAuth(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const btn = document.getElementById('auth-btn');
    const errDiv = document.getElementById('auth-error');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    errDiv.innerHTML = '';

    try {
      const isLogin = form.has('password') && !form.has('password2');
      const data = Object.fromEntries(form);
      const res = isLogin ? await API.login(data) : await API.register(data);
      API.setTokens(res.tokens.access, res.tokens.refresh);
      this.state.user = res.user;
      this.route('dashboard');
    } catch (err) {
      errDiv.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = e.target.querySelector('[name="password2"]') ? 'Create Account' : 'Sign In';
    }
  },

  async loadProfile() {
    try { this.state.user = await API.profile(); } catch { API.clearTokens(); }
  },

  logout() {
    API.clearTokens();
    this.state.user = null;
    this.route('auth');
  },

  // ─── Dashboard ──────────────────────────────────────────────
  async renderDashboard(root) {
    root.innerHTML = this.appLayout(`
      <div class="main-header">
        <div><h1>Projects</h1><div class="subtitle">Your AI agents</div></div>
        <div class="actions">
          <button class="btn btn-primary btn-sm" onclick="App.showCreateProjectModal()">+ New Project</button>
        </div>
      </div>
      <div class="main-body"><div class="loading-overlay"><div class="spinner"></div></div></div>
    `);
    this.updateSidebar('projects');

    try {
      const data = await API.listProjects();
      this.state.projects = data.results || data;
      this.renderProjectGrid();
    } catch (err) {
      document.querySelector('.main-body').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  },

  renderProjectGrid() {
    const body = document.querySelector('.main-body');
    if (!this.state.projects.length) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="icon">📁</div>
          <h3>No projects yet</h3>
          <p>Create your first AI agent project to get started.</p>
          <button class="btn btn-primary btn-sm" onclick="App.showCreateProjectModal()">+ Create Project</button>
        </div>`;
      return;
    }
    body.innerHTML = `<div class="project-grid">${this.state.projects.map(p => `
      <div class="project-card" onclick="App.openProject(${p.id})">
        <div class="project-card-header">
          <h3>${this.esc(p.name)}</h3>
          <span class="model-badge">${this.esc(p.model)}</span>
        </div>
        <p>${this.esc(p.description || 'No description')}</p>
        <div class="project-card-meta">
          <span>📝 ${p.prompt_count} prompts</span>
          <span>📎 ${p.file_count} files</span>
          <span>🧠 ${p.memory_window} ctx</span>
        </div>
      </div>`).join('')}</div>`;
  },

  showCreateProjectModal() {
    this.showModal('New Project', `
      <div class="form-group">
        <label>Name</label>
        <input class="form-input" id="proj-name" placeholder="My AI Agent" required>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input class="form-input" id="proj-desc" placeholder="What does this agent do?">
      </div>
      <div class="form-group">
        <label>Memory Window</label>
        <input class="form-input" type="number" id="proj-memory" value="20" min="1" max="200">
      </div>
    `, async () => {
      const data = {
        name: document.getElementById('proj-name').value,
        description: document.getElementById('proj-desc').value,
        memory_window: parseInt(document.getElementById('proj-memory').value) || 20,
      };
      if (!data.name.trim()) return;
      const p = await API.createProject(data);
      this.state.projects.unshift(p);
      this.closeModal();
      this.renderProjectGrid();
    });
  },

  async openProject(id) {
    this.route('project', { project: null });
    root = document.getElementById('root');
    root.innerHTML = this.appLayout(`
      <div class="main-header">
        <div><h1>Loading...</h1></div>
      </div>
      <div class="main-body"><div class="loading-overlay"><div class="spinner"></div></div></div>
    `);

    try {
      const project = await API.getProject(id);
      this.state.project = project;
      this.renderProjectDetail(document.getElementById('root'));
    } catch (err) {
      document.querySelector('.main-body').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  },

  // ─── Project Detail ──────────────────────────────────────────
  renderProjectDetail(root) {
    const p = this.state.project;
    if (!p) return;
    root.innerHTML = this.appLayout(`
      <div class="main-header">
        <div>
          <h1>${this.esc(p.name)}</h1>
          <div class="subtitle">${this.esc(p.description || 'No description')} &middot; <span class="model-badge">${this.esc(p.model)}</span></div>
        </div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="App.openChat(${p.id})">💬 Chat</button>
          <button class="btn btn-danger btn-sm" onclick="App.deleteProject(${p.id})">Delete</button>
        </div>
      </div>
      <div class="main-body">
        <div class="detail-tabs">
          <button class="detail-tab active" onclick="App.switchDetailTab('prompts', this)">Prompts</button>
          <button class="detail-tab" onclick="App.switchDetailTab('files', this)">Files</button>
          <button class="detail-tab" onclick="App.switchDetailTab('settings', this)">Settings</button>
        </div>
        <div id="detail-content"></div>
      </div>
    `);
    this.updateSidebar('projects');
    this.switchDetailTab('prompts');
  },

  switchDetailTab(tab, el) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    else document.querySelector(`.detail-tab`)?.classList.add('active');
    const c = document.getElementById('detail-content');
    if (tab === 'prompts') this.renderPrompts(c);
    else if (tab === 'files') this.renderFiles(c);
    else this.renderProjectSettings(c);
  },

  async renderPrompts(container) {
    const p = this.state.project;
    const prompts = p.prompts || [];
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="color:var(--text-secondary);font-size:13px">${prompts.length} prompt(s)</span>
        <button class="btn btn-secondary btn-sm" onclick="App.showAddPromptModal()">+ Add Prompt</button>
      </div>
      ${prompts.length ? prompts.map(pr => `
        <div class="prompt-card">
          <div class="prompt-card-header">
            <h4>${this.esc(pr.name)}</h4>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="type-badge ${pr.is_system_prompt ? 'system' : 'user'}">${pr.is_system_prompt ? 'System' : 'User'}</span>
              <button class="btn btn-ghost btn-sm" onclick="App.deletePrompt(${pr.id})">✕</button>
            </div>
          </div>
          <pre>${this.esc(pr.content)}</pre>
        </div>`).join('') : '<div class="empty-state"><p>No prompts yet. Add one to shape your agent\'s behavior.</p></div>'}`;
  },

  showAddPromptModal() {
    this.showModal('Add Prompt', `
      <div class="form-group">
        <label>Name</label>
        <input class="form-input" id="pr-name" placeholder="e.g. System Prompt" required>
      </div>
      <div class="form-group">
        <label>Type</label>
        <select class="form-select" id="pr-type">
          <option value="true">System Prompt</option>
          <option value="false">User Prompt</option>
        </select>
      </div>
      <div class="form-group">
        <label>Content</label>
        <textarea class="form-input" id="pr-content" rows="6" placeholder="You are a helpful assistant..." style="font-family:var(--mono);font-size:13px"></textarea>
      </div>
    `, async () => {
      const data = {
        name: document.getElementById('pr-name').value,
        content: document.getElementById('pr-content').value,
        is_system_prompt: document.getElementById('pr-type').value === 'true',
      };
      if (!data.name.trim() || !data.content.trim()) return;
      const pr = await API.createPrompt(this.state.project.id, data);
      this.state.project.prompts.unshift(pr);
      this.closeModal();
      this.renderPrompts(document.getElementById('detail-content'));
    });
  },

  async deletePrompt(id) {
    if (!await Confirm.show('Delete this prompt?')) return;
    try {
      await API.deletePrompt(this.state.project.id, id);
      this.state.project.prompts = this.state.project.prompts.filter(p => p.id !== id);
      this.renderPrompts(document.getElementById('detail-content'));
      Toast.success('Prompt deleted');
    } catch (err) { Toast.error(err.message); }
  },

  async renderFiles(container) {
    const files = this.state.project.files || [];
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="color:var(--text-secondary);font-size:13px">${files.length} file(s)</span>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          + Upload File
          <input type="file" style="display:none" onchange="App.handleFileUpload(this.files[0])" accept=".txt,.pdf,.md,.csv,.json,.py,.js,.ts,.doc,.docx">
        </label>
      </div>
      ${files.length ? files.map(f => `
        <div class="file-item">
          <div class="file-icon">📄</div>
          <div class="file-info">
            <div class="file-name">${this.esc(f.original_name)}</div>
            <div class="file-meta">${this.formatBytes(f.size_bytes)} &middot; ${f.mime_type || 'unknown'}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.deleteFile(${f.id})">✕</button>
        </div>`).join('') : '<div class="empty-state"><p>No files uploaded. Add files to give your agent knowledge.</p></div>'}`;
  },

  async handleFileUpload(file) {
    if (!file) return;
    try {
      const f = await API.uploadProjectFile(this.state.project.id, file);
      this.state.project.files.unshift(f);
      this.renderFiles(document.getElementById('detail-content'));
    } catch (err) { Toast.error('Upload failed: ' + err.message); }
  },

  async deleteFile(id) {
    if (!await Confirm.show('Delete this file?')) return;
    try {
      await API.deleteFile(this.state.project.id, id);
      this.state.project.files = this.state.project.files.filter(f => f.id !== id);
      this.renderFiles(document.getElementById('detail-content'));
      Toast.success('File deleted');
    } catch (err) { Toast.error(err.message); }
  },

  renderProjectSettings(container) {
    const p = this.state.project;
    container.innerHTML = `
      <div class="settings-grid">
        <div class="setting-group">
          <h3>Project Settings</h3>
          <div class="form-group">
            <label>Name</label>
            <input class="form-input" id="set-name" value="${this.esc(p.name)}">
          </div>
          <div class="form-group">
            <label>Description</label>
            <input class="form-input" id="set-desc" value="${this.esc(p.description || '')}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Model (managed by admin)</label>
              <div class="form-input" style="opacity:0.6;cursor:not-allowed;display:flex;align-items:center;gap:8px">
                <span class="model-badge">${this.esc(p.model)}</span>
                <span style="font-size:12px;color:var(--text-muted)">locked</span>
              </div>
            </div>
            <div class="form-group">
              <label>Memory Window</label>
              <input class="form-input" type="number" id="set-memory" value="${p.memory_window}" min="1" max="200">
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="App.saveProjectSettings()" style="margin-top:8px">Save Changes</button>
        </div>
      </div>`;
  },

  async saveProjectSettings() {
    const data = {
      name: document.getElementById('set-name').value,
      description: document.getElementById('set-desc').value,
      memory_window: parseInt(document.getElementById('set-memory').value) || 20,
    };
    try {
      const updated = await API.updateProject(this.state.project.id, data);
      this.state.project = updated;
      const idx = this.state.projects.findIndex(p => p.id === updated.id);
      if (idx !== -1) this.state.projects[idx] = updated;
      Toast.success('Saved!');
    } catch (err) { Toast.error('Error: ' + err.message); }
  },

  async deleteProject(id) {
    if (!await Confirm.show('Delete this project and all its data? This cannot be undone.')) return;
    try {
      await API.deleteProject(id);
      this.state.projects = this.state.projects.filter(p => p.id !== id);
      this.state.project = null;
      this.route('dashboard');
      Toast.success('Project deleted');
    } catch (err) { Toast.error(err.message); }
  },

  // ─── Chat ────────────────────────────────────────────────────
  renderChat(root) {},

  async openChat(projectId) {
    let project = this.state.project;
    if (!project || project.id !== projectId) {
      project = await API.getProject(projectId);
      this.state.project = project;
    }
    this.route('chat', { conversations: [], conversation: null });

    const root = document.getElementById('root');
    root.innerHTML = `
      <div class="chat-layout">
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">
            <div class="chat-sidebar-title">
              <button class="sidebar-btn" onclick="App.route('project', {project:App.state.project})" title="Back to project">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h3>Chats</h3>
            </div>
            <button class="sidebar-btn sidebar-btn-accent" onclick="App.newConversation()" title="New chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <div class="conversation-list" id="conv-list"><div class="loading-overlay"><div class="spinner"></div></div></div>
        </div>
        <div class="chat-main">
          <div class="chat-header">
            <div class="chat-header-info">
              <div class="chat-header-avatar">⚡</div>
              <div>
                <div class="chat-header-name">${this.esc(project.name)}</div>
                <div class="chat-header-meta">Memory: ${project.memory_window} messages</div>
              </div>
            </div>
          </div>
          <div class="chat-messages" id="chat-messages">
            <div class="chat-welcome">
              <div class="chat-welcome-icon">💬</div>
              <h3>Start chatting</h3>
              <p>Send a message to begin talking with <strong>${this.esc(project.name)}</strong></p>
            </div>
          </div>
          <div class="chat-input-area">
            <div class="chat-input-wrapper">
              <textarea class="chat-input" id="chat-input" placeholder="Message ${this.esc(project.name)}..." rows="1"
                onkeydown="App.handleChatKey(event)" oninput="App.autoResize(this)"></textarea>
              <button class="send-btn" id="send-btn" onclick="App.sendChat()" title="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
            <div class="chat-input-hint">Press Enter to send, Shift+Enter for new line</div>
          </div>
        </div>
      </div>`;

    this.loadConversations();
  },

  async loadConversations() {
    try {
      const data = await API.listConversations(this.state.project.id);
      this.state.conversations = data.results || data;
      this.renderConvList();
    } catch {}
  },

  renderConvList() {
    const el = document.getElementById('conv-list');
    if (!el) return;
    if (!this.state.conversations.length) {
      el.innerHTML = '<div class="conv-empty">No conversations yet.<br>Start one by sending a message.</div>';
      return;
    }
    el.innerHTML = this.state.conversations.map(c => `
      <div class="conversation-item ${this.state.conversation?.id === c.id ? 'active' : ''}"
           onclick="App.loadConversation(${c.id})">
        <div class="conv-item-icon">💬</div>
        <div class="conv-item-body">
          <div class="title">${this.esc(c.title)}</div>
          <div class="meta">${c.message_count} messages · ${this.timeAgo(c.updated_at)}</div>
        </div>
      </div>`).join('');
  },

  async newConversation() {
    this.state.conversation = null;
    document.getElementById('chat-messages').innerHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome-icon">💬</div>
        <h3>Start chatting</h3>
        <p>Send a message to begin.</p>
      </div>`;
    this.renderConvList();
  },

  async loadConversation(id) {
    try {
      const conv = await API.getConversation(id);
      this.state.conversation = conv;
      this.renderConvList();
      this.renderMessages(conv.messages);
    } catch (err) {
      Toast.error('Failed to load conversation: ' + err.message);
    }
  },

  renderMessages(messages) {
    const el = document.getElementById('chat-messages');
    if (!messages.length) {
      el.innerHTML = '<div class="chat-welcome"><div class="chat-welcome-icon">💬</div><h3>Start chatting</h3><p>Send a message to begin.</p></div>';
      return;
    }
    el.innerHTML = messages.map(m => `
      <div class="message ${m.role}">
        <div class="message-avatar">${m.role === 'user' ? '👤' : '⚡'}</div>
        <div class="message-content">
          <div class="message-role">${m.role === 'user' ? 'You' : this.esc(this.state.project?.name || 'Assistant')}</div>
          <div class="message-bubble">${this.renderMarkdown(m.content)}</div>
        </div>
      </div>`).join('');
    el.scrollTop = el.scrollHeight;
  },

  renderMarkdown(text) {
    let html = this.esc(text);
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return html;
  },

  handleChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat(); }
  },

  autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  },

  async sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    input.style.height = 'auto';
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;

    const messagesEl = document.getElementById('chat-messages');
    if (!this.state.conversation) {
      messagesEl.innerHTML = '';
    }

    messagesEl.innerHTML += `
      <div class="message user">
        <div class="message-avatar">👤</div>
        <div class="message-content">
          <div class="message-role">You</div>
          <div class="message-bubble">${this.renderMarkdown(msg)}</div>
        </div>
      </div>
      <div class="message assistant" id="loading-msg">
        <div class="message-avatar">⚡</div>
        <div class="message-content">
          <div class="message-role">${this.esc(this.state.project?.name || 'Assistant')}</div>
          <div class="message-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>
        </div>
      </div>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const data = {
        project_id: this.state.project.id,
        message: msg,
      };
      if (this.state.conversation) data.conversation_id = this.state.conversation.id;

      const res = await API.sendMessage(data);

      if (!this.state.conversation) {
        this.state.conversation = { id: res.conversation_id, title: msg.slice(0, 80), messages: [] };
        setTimeout(() => this.loadConversations(), 1000);
      }

      const loadingEl = document.getElementById('loading-msg');
      if (loadingEl) {
        loadingEl.outerHTML = `
          <div class="message assistant">
            <div class="message-avatar">⚡</div>
            <div class="message-content">
              <div class="message-role">${this.esc(this.state.project?.name || 'Assistant')}</div>
              <div class="message-bubble">${this.renderMarkdown(res.message)}</div>
            </div>
          </div>`;
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } catch (err) {
      const loadingEl = document.getElementById('loading-msg');
      if (loadingEl) {
        const safeMsg = this.esc(err.message || 'Something went wrong. Please try again.');
        loadingEl.outerHTML = `
          <div class="message assistant">
            <div class="message-avatar">⚡</div>
            <div class="message-content">
              <div class="message-role">${this.esc(this.state.project?.name || 'Assistant')}</div>
              <div class="message-bubble message-error">${safeMsg}</div>
            </div>
          </div>`;
      }
      }
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  },

  // ─── Settings ────────────────────────────────────────────────
  async renderSettings(root) {
    const user = this.state.user || {};
    root.innerHTML = this.appLayout(`
      <div class="main-header">
        <div><h1>Settings</h1><div class="subtitle">Manage your account</div></div>
      </div>
      <div class="main-body">
        <div class="settings-grid">
          <div class="setting-group">
            <h3>Profile</h3>
            <div class="form-row">
              <div class="form-group">
                <label>First Name</label>
                <input class="form-input" id="set-fname" value="${this.esc(user.first_name || '')}">
              </div>
              <div class="form-group">
                <label>Last Name</label>
                <input class="form-input" id="set-lname" value="${this.esc(user.last_name || '')}">
              </div>
            </div>
            <div class="form-group">
              <label>Bio</label>
              <textarea class="form-input" id="set-bio" rows="3">${this.esc(user.profile?.bio || '')}</textarea>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.saveProfile()">Save</button>
          </div>
          <div class="setting-group">
            <h3>Account</h3>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">
              <strong>${this.esc(user.username)}</strong> &middot; ${this.esc(user.email)}
            </p>
            <button class="btn btn-danger btn-sm" onclick="App.logout()">Sign Out</button>
          </div>
        </div>
      </div>
    `);
    this.updateSidebar('settings');
  },

  async saveProfile() {
    try {
      const data = {
        first_name: document.getElementById('set-fname').value,
        last_name: document.getElementById('set-lname').value,
        bio: document.getElementById('set-bio').value,
      };
      this.state.user = await API.updateProfile(data);
      Toast.success('Profile updated!');
    } catch (err) { Toast.error('Error: ' + err.message); }
  },

  // ─── Layout Helpers ──────────────────────────────────────────
  appLayout(mainContent) {
    const u = this.state.user || {};
    const initials = ((u.first_name || '')[0] || '') + ((u.last_name || '')[0] || '') || (u.username || '?')[0].toUpperCase();
    return `
      <div class="app">
        <div class="sidebar">
          <div class="sidebar-header">
            <div class="logo-sm">⚡</div>
            <h2>ChatForge</h2>
          </div>
          <div class="sidebar-nav">
            <div class="nav-section">
              <div class="nav-section-title">Menu</div>
              <div class="nav-item" data-nav="projects" onclick="App.route('dashboard')">
                <span class="icon">📁</span> Projects
              </div>
              <div class="nav-item" data-nav="settings" onclick="App.route('settings')">
                <span class="icon">⚙️</span> Settings
              </div>
            </div>
          </div>
          <div class="sidebar-footer">
            <div class="user-info" onclick="App.route('settings')">
              <div class="user-avatar">${initials.toUpperCase()}</div>
              <div class="user-details">
                <div class="user-name">${this.esc(u.first_name || u.username || '')}</div>
                <div class="user-email">${this.esc(u.email || '')}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="main">${mainContent}</div>
      </div>`;
  },

  updateSidebar(active) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === active);
    });
  },

  showModal(title, body, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" onclick="App.closeModal()">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" onclick="App.closeModal()">Cancel</button>
          <button class="btn btn-primary btn-sm" id="modal-save">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    document.getElementById('modal-save').onclick = onSave;
    overlay.addEventListener('click', e => { if (e.target === overlay) this.closeModal(); });
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) { overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 200); }
  },

  // ─── Utilities ───────────────────────────────────────────────
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
