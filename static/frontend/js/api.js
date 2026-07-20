const API = {
  BASE: '/api',

  token() { return localStorage.getItem('access_token'); },
  refresh() { return localStorage.getItem('refresh_token'); },
  setTokens(access, refresh) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  },
  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  async request(method, path, body = null, extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    const token = this.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    let res = await fetch(`${this.BASE}${path}`, opts);

    if (res.status === 401 && this.refresh()) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.token()}`;
        res = await fetch(`${this.BASE}${path}`, { ...opts, headers });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error || err.detail || (typeof err === 'string' ? err : '');
      throw new Error(msg || `Request failed (HTTP ${res.status})`);
    }
    if (res.status === 204) return {};
    return res.json();
  },

  async tryRefresh() {
    try {
      const res = await fetch(`${this.BASE}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: this.refresh() }),
      });
      if (!res.ok) { this.clearTokens(); return false; }
      const data = await res.json();
      this.setTokens(data.access, this.refresh());
      return true;
    } catch { this.clearTokens(); return false; }
  },

  async uploadFile(method, path, file) {
    const headers = {};
    const token = this.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${this.BASE}${path}`, { method, headers, body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // Auth
  register(data) { return this.request('POST', '/auth/register/', data); },
  login(data) { return this.request('POST', '/auth/login/', data); },
  profile() { return this.request('GET', '/auth/profile/'); },
  updateProfile(data) { return this.request('PATCH', '/auth/profile/', data); },

  // Projects
  listProjects() { return this.request('GET', '/projects/'); },
  getProject(id) { return this.request('GET', `/projects/${id}/`); },
  createProject(data) { return this.request('POST', '/projects/', data); },
  updateProject(id, data) { return this.request('PATCH', `/projects/${id}/`, data); },
  deleteProject(id) { return this.request('DELETE', `/projects/${id}/`); },

  // Prompts
  listPrompts(pid) { return this.request('GET', `/projects/${pid}/prompts/`); },
  createPrompt(pid, data) { return this.request('POST', `/projects/${pid}/prompts/`, data); },
  updatePrompt(pid, id, data) { return this.request('PATCH', `/projects/${pid}/prompts/${id}/`, data); },
  deletePrompt(pid, id) { return this.request('DELETE', `/projects/${pid}/prompts/${id}/`); },

  // Files
  listFiles(pid) { return this.request('GET', `/projects/${pid}/files/`); },
  uploadProjectFile(pid, file) { return this.uploadFile('POST', `/projects/${pid}/files/`, file); },
  deleteFile(pid, id) { return this.request('DELETE', `/projects/${pid}/files/${id}/`); },

  // Chat
  listConversations(pid) { return this.request('GET', `/chat/conversations/?project_id=${pid}`); },
  getConversation(id) { return this.request('GET', `/chat/conversations/${id}/`); },
  sendMessage(data) { return this.request('POST', '/chat/send/', data); },

  // Health
  health() { return this.request('GET', '/health/'); },
};
