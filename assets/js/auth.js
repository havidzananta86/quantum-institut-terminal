/**
 * Quantum Institut — Auth Client Library & Session Guard
 * Menangani validasi token, role PRO, dan session manajemen perangkat.
 *
 * Penyimpanan sesi: qi_token / qi_user / qi_user_name di localStorage ("Ingat perangkat ini")
 * ATAU sessionStorage (hanya tab ini) — tidak pernah keduanya. getToken() membaca localStorage
 * lebih dulu, jadi salinan lama di penyimpanan lain akan MENUTUPI sesi baru; saveSession()
 * karena itu selalu membersihkan penyimpanan yang lain dan memastikan hasilnya dengan membaca ulang.
 */

const QI_KUNCI_SESI = ['qi_token', 'qi_user', 'qi_user_name'];

const QuantumAuth = {
    getToken() {
        try {
            return localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token');
        } catch (e) {
            try { return sessionStorage.getItem('qi_token'); } catch (e2) { return null; }
        }
    },

    getUserData() {
        try {
            const raw = localStorage.getItem('qi_user') || sessionStorage.getItem('qi_user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    // Bangun header fetch lengkap dengan Bearer token bila sesi ada.
    // Dipakai endpoint ber-qi_require_auth() supaya tidak balik 401.
    authHeaders(extra) {
        const headers = Object.assign({}, extra || {});
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    },

    // Sinyal batas waktu untuk fetch. AbortSignal.timeout tidak ada di Safari/iOS < 16:
    // memanggilnya langsung melempar TypeError yang lalu tampil sebagai "server tidak dapat
    // dihubungi". Cadangannya AbortController + setTimeout.
    batasWaktu(ms) {
        try {
            if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
        } catch (e) {}
        try {
            const c = new AbortController();
            setTimeout(() => { try { c.abort(); } catch (e) {} }, ms);
            return c.signal;
        } catch (e) {
            return undefined;
        }
    },

    // Peran → tingkat akses; normalisasi sama dengan qiNormalisasiPeran (halaman-dashboard-awal.js).
    normalisasiPeran(role) {
        const s = String(role || '').toLowerCase();
        if (s === 'admin') return 'admin';
        if (s === 'vip' || s === 'vip_plus' || s === 'elite') return 'vip';
        if (s === 'pro' || s === 'premium') return 'pro';
        return 'free';
    },

    labelPeran(role) {
        return this.normalisasiPeran(role).toUpperCase();
    },

    // Nama untuk "Masuk sebagai …": nama lengkap → nama → bagian depan email → "Trader".
    namaTampilan(u) {
        u = u || {};
        let n = String(u.full_name || u.name || '').trim();
        if (!n && u.email) n = String(u.email).split('@')[0].trim();
        if (!n) n = 'Trader';
        return n.length > 40 ? n.slice(0, 39) + '…' : n;
    },

    // Simpan sesi. Mengembalikan true HANYA bila token yang sama terbaca kembali — false bila
    // browser menolak penyimpanan (data situs diblokir, sebagian mode privat) atau bila salinan
    // lama masih menutupinya. Pemanggil wajib berhenti (tidak pindah halaman) bila false.
    // Gagal di tengah jalan (mis. qi_token tertulis lalu qi_user kena kuota) → semua kunci sesi
    // dihapus lagi: jangan tinggalkan token yang sesinya akan dibuang pemanggil di server.
    saveSession(token, userData, remember = true) {
        let simpan, lain;
        try {
            simpan = remember ? localStorage : sessionStorage;
            lain = remember ? sessionStorage : localStorage;
        } catch (e) {
            return false;
        }
        QI_KUNCI_SESI.forEach(k => { try { lain.removeItem(k); } catch (e) {} });
        try {
            simpan.setItem('qi_token', token);
            if (userData) {
                simpan.setItem('qi_user', JSON.stringify(userData));
                simpan.setItem('qi_user_name', this.namaTampilan(userData));
            } else {
                simpan.removeItem('qi_user');
                simpan.removeItem('qi_user_name');
            }
        } catch (e) {
            this.hapusSesi();
            return false;
        }
        if (!token || this.getToken() !== token) {
            this.hapusSesi();
            return false;
        }
        return true;
    },

    // Hapus sesi dari KEDUA penyimpanan (dipakai saat sesi ditolak server dan saat keluar).
    hapusSesi() {
        QI_KUNCI_SESI.forEach(k => {
            try { localStorage.removeItem(k); } catch (e) {}
            try { sessionStorage.removeItem(k); } catch (e) {}
        });
    },

    // Server MENOLAK sesi (bukan sekadar gangguan): HTTP 401 dengan kode AUTH_REQUIRED (token tak
    // dikenal / kedaluwarsa / akun nonaktif) atau 2FA_REQUIRED (login belum lolos verifikasi dua
    // langkah). 401 tanpa kode itu, 5xx, dan galat jaringan BUKAN bukti — sesi tetap disimpan.
    // Aturan yang sama ada di halaman-dashboard-awal.js.
    // CATATAN: api/auth.php (verify_token) saat ini juga menjawab 401 AUTH_REQUIRED bila MySQL
    // tidak terjangkau; selama itu belum dibedakan (503) di server, gangguan DB tetap terbaca "ditolak".
    sesiDitolak(http, data) {
        return http === 401 && !!data && (data.code === 'AUTH_REQUIRED' || data.code === '2FA_REQUIRED');
    },

    // Periksa token ke server. Hasil: { sah, http, peran, ditolak, kode }.
    //   ditolak  → sesi pasti tidak berlaku (hapus & minta masuk lagi), lihat sesiDitolak();
    //   http 0   → server tidak terjangkau (bukan bukti sesi tidak sah);
    //   lainnya  → gangguan server.
    async verifyServerSession() {
        const token = this.getToken();
        if (!token) return { sah: false, http: 401, peran: null, ditolak: true, kode: null };

        try {
            const res = await fetch('api/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type: 'verify_token', token: token }),
                signal: this.batasWaktu(4000)
            });
            const data = await res.json().catch(() => null);
            const sah = res.ok && !!data && data.status === 'success';
            return {
                sah, http: res.status, peran: sah && data.data ? (data.data.role || null) : null,
                ditolak: this.sesiDitolak(res.status, data), kode: (data && data.code) || null
            };
        } catch (e) {
            return { sah: false, http: 0, peran: null, ditolak: false, kode: null };
        }
    },

    // Tujuan setelah masuk: halaman ini (nama berkas + ?query + #hash), bukan URL penuh.
    enforceAuthGuard() {
        const token = this.getToken();
        if (!token) {
            console.warn('[QI Auth Guard] Sesi tidak ditemukan. Mengarahkan ke login...');
            try {
                sessionStorage.setItem('qi_redirect_after_login', (location.pathname.split('/').pop() || 'index.html') + location.search + location.hash);
                sessionStorage.setItem('qi_alasan_masuk', 'perlu_masuk');
            } catch (e) {}
            window.location.replace('login.html');
            return false;
        }
        return true;
    },

    async logout() {
        const token = this.getToken();
        if (token) {
            try {
                await fetch('api/logout.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    signal: this.batasWaktu(3000)
                });
            } catch (e) {
                console.warn('[QI Auth] Logout server notification failed', e);
            }
        }
        this.hapusSesi();
        // Halaman masuk menampilkan "Anda sudah keluar." (sekali, lalu kunci ini dihapus).
        try { sessionStorage.setItem('qi_alasan_masuk', 'keluar'); } catch (e) {}
        window.location.href = 'login.html';
    }
};

window.QuantumAuth = QuantumAuth;
window.checkUserSession = () => !!QuantumAuth.getToken();
window.logoutUser = () => QuantumAuth.logout();
