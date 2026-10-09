/**
 * Quantum Institut Main App Script
 * Includes Universal Quantum Toast Notification Component
 */

function showQuantumToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('quantumToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'quantumToastContainer';
        container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none px-4 sm:px-0';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const typeStyles = {
        success: 'bg-[#0A182E]/95 border-emerald-500/60 text-emerald-300 shadow-emerald-500/20',
        error:   'bg-[#0A182E]/95 border-rose-500/60 text-rose-300 shadow-rose-500/20',
        warning: 'bg-[#0A182E]/95 border-amber-500/60 text-amber-300 shadow-amber-500/20',
        info:    'bg-[#0A182E]/95 border-cyan-500/60 text-cyan-300 shadow-cyan-500/20'
    };
    const icons = {
        success: '✓',
        error:   '✕',
        warning: '⚠',
        info:    'ℹ'
    };

    const styleClass = typeStyles[type] || typeStyles.info;
    const icon = icons[type] || 'ℹ️';

    toast.className = `pointer-events-auto p-3.5 rounded-xl border backdrop-blur-xl shadow-xl font-mono text-xs flex items-center gap-3 transition-all duration-300 opacity-0 translate-y-3 ${styleClass}`;
    toast.innerHTML = `<span class="text-base">${icon}</span><span class="flex-1 leading-relaxed">${message}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-3');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-3');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

window.showQuantumToast = showQuantumToast;
window.showToast = showQuantumToast;

document.addEventListener('DOMContentLoaded', () => {
    // Scroll reveal observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Mobile Menu Drawer Handler
    const mobileBtn  = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileBtn && mobileMenu) {
        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('hidden');
        });

        // Tutup menu mobile otomatis saat link nav diklik
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });

        // Tutup menu mobile saat klik di luar menu
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !mobileBtn.contains(e.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    // Smooth Scroll Handler untuk semua anchor link dengan id target (#)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#' || targetId === '') return;

            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                targetEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                history.pushState(null, null, targetId);
            }
        });
    });
});
