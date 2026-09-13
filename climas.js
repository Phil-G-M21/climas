/* ============================================================
   CLIMAS — shared front-end logic
   Supabase auth + data, cart, nav state, toasts.
   Loaded on every page AFTER the supabase-js UMD script.
   ============================================================ */

/* ── 1. CONFIG — fill these in from your Supabase project ──
   Supabase dashboard  ->  Project Settings  ->  API
   The anon key is safe to expose in the browser. Row Level
   Security (set up in schema.sql) is what protects your data.       */
const SUPABASE_URL      = 'https://fobuhwuanpumpuolbspk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYnVod3VhbnB1bXB1b2xic3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTg5MzcsImV4cCI6MjEwNDg3NDkzN30.uRfbHxJWxWyQjSplWhVKnkxATBNGRvXkEEcr9i5g5bM';

/* ── 2. CLIENT ── */
const _sb = (window.supabase && SUPABASE_URL.indexOf('YOUR-PROJECT') === -1)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const CLIMAS = {
  sb: _sb,
  configured: !!_sb,

  /* ---- money ---- */
  money(pesewas) {
    if (pesewas == null) return '';
    const cedis = pesewas / 100;
    return 'GH\u20B5' + (Number.isInteger(cedis) ? cedis : cedis.toFixed(2));
  },

  /* ---- auth ---- */
  async getUser() {
    if (!this.sb) return null;
    const { data } = await this.sb.auth.getUser();
    return data ? data.user : null;
  },
  async signUp(email, password, fullName) {
    if (!this.sb) throw new Error('Backend not configured yet.');
    const { data, error } = await this.sb.auth.signUp({
      email, password,
      options: { data: { full_name: fullName || '' } }
    });
    if (error) throw error;
    // With email confirmation OFF, a session is returned immediately.
    if (!data.session) {
      const { error: e2 } = await this.sb.auth.signInWithPassword({ email, password });
      if (e2) throw e2;
    }
    return data;
  },
  async signIn(email, password) {
    if (!this.sb) throw new Error('Backend not configured yet.');
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signOut() {
    if (this.sb) await this.sb.auth.signOut();
    location.href = 'index.html';
  },
  async requireAuth() {
    const user = await this.getUser();
    if (!user) { location.href = 'account.html?next=' + encodeURIComponent(location.pathname.split('/').pop()); return null; }
    return user;
  },

  /* ---- profile ---- */
  async getProfile(userId) {
    if (!this.sb) return null;
    const { data } = await this.sb.from('profiles').select('*').eq('id', userId).single();
    return data;
  },
  async updateProfile(userId, fields) {
    if (!this.sb) throw new Error('Backend not configured yet.');
    const { error } = await this.sb.from('profiles').update(fields).eq('id', userId);
    if (error) throw error;
  },

  /* ---- products ---- */
  async getProducts() {
    if (!this.sb) return [];
    const { data, error } = await this.sb.from('products').select('*').eq('active', true).order('sort');
    if (error) throw error;
    return data || [];
  },

  /* ---- orders ---- */
  async createOrder(order, items) {
    if (!this.sb) throw new Error('Backend not configured yet.');
    const { data: o, error } = await this.sb.from('orders').insert(order).select().single();
    if (error) throw error;
    if (items && items.length) {
      const rows = items.map(it => ({ ...it, order_id: o.id }));
      const { error: e2 } = await this.sb.from('order_items').insert(rows);
      if (e2) throw e2;
    }
    return o;
  },
  async getOrders(userId) {
    if (!this.sb) return [];
    const { data, error } = await this.sb.from('orders')
      .select('*, order_items(*)').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /* ---- contact ---- */
  async sendMessage(msg) {
    if (!this.sb) throw new Error('Backend not configured yet.');
    const { error } = await this.sb.from('contact_messages').insert(msg);
    if (error) throw error;
  },

  /* ---- cart (localStorage) ---- */
  getCart() {
    try { return JSON.parse(localStorage.getItem('climas_cart') || 'null'); }
    catch (e) { return null; }
  },
  setCart(cart) {
    localStorage.setItem('climas_cart', JSON.stringify(cart));
    this.renderCartCount();
  },
  clearCart() { localStorage.removeItem('climas_cart'); this.renderCartCount(); },
  cartCount() { return this.getCart() ? 1 : 0; },

  /* ---- toast ---- */
  toast(message, type) {
    let host = document.querySelector('.toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = message;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
  },

  /* ---- nav state ---- */
  async renderNav() {
    this.renderCartCount();
    const signInLink = document.querySelector('[data-nav="signin"]');
    if (signInLink) {
      const user = await this.getUser();
      if (user) { signInLink.textContent = 'Account'; signInLink.setAttribute('href', 'account.html'); }
    }
  },
  renderCartCount() {
    const n = this.cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = n;
      el.classList.toggle('empty', n === 0);
    });
  }
};

/* ── mobile menu + nav init (runs on every page) ── */
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.querySelector('.burger');
  const menu = document.querySelector('.mobile-menu');
  if (burger && menu) {
    burger.addEventListener('click', () => {
      menu.classList.toggle('open');
      burger.classList.toggle('open');
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      menu.classList.remove('open');
      burger.classList.remove('open');
    }));
  }
  CLIMAS.renderNav();

  if (!CLIMAS.configured) {
    // Visible, honest heads-up while the Supabase keys are still placeholders.
    console.warn('CLIMAS: Supabase not configured. Add your project URL and anon key in climas.js.');
  }
});
