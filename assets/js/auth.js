/**
 * Quantum Institut — Auth Client Library & Session Guard
 * Menangani validasi token, role PRO, dan session manajemen perangkat.
 */

const QuantumAuth = {
    getToken() {
        try {
            return localStorage.getItem('qi_token') || sessionStorage.getItem('qi_token');
        } catch (e) {
            return null;
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

    saveSession(token, userData, remember = true) {
        try {
            const storage = remember ? localStorage : sessionStorage;
            storage.setItem('qi_token', token);
            if (userData) {
                storage.setItem('qi_user', JSON.stringify(userData));
            }
        } catch (e) {}
    },

    async verifyServerSession() {
        const token = this.getToken();
        if (!token) return false;

        try {
            const res = await fetch('api/auth.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type: 'verify_token', token: token }),
                signal: AbortSignal.timeout(4000)
            });

            if (res.ok) {
                const data = await res.json();
                return data?.status === 'success';
            }
        } catch (e) {
            // Server tidak terjangkau: jangan anggap sesi valid (sebelumnya token >= 16 char lolos)
            return false;
        }
        return false;
    },

    enforceAuthGuard() {
        const token = this.getToken();
        if (!token) {
            // Tampilkan modal atau redirect login
            console.warn('[QI Auth Guard] Sesi tidak ditemukan. Mengarahkan ke login...');
            // Simpan intended URL untuk redirect balik
            sessionStorage.setItem('qi_redirect_after_login', window.location.href);
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    logout() {
        try {
            localStorage.removeItem('qi_token');
            localStorage.removeItem('qi_user');
            sessionStorage.removeItem('qi_token');
            sessionStorage.removeItem('qi_user');
        } catch (e) {}
        window.location.href = 'login.html';
    }
};

window.QuantumAuth = QuantumAuth;
window.checkUserSession = () => !!QuantumAuth.getToken();
window.logoutUser = () => QuantumAuth.logout();
