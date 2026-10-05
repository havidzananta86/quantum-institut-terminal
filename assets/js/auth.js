/**
 * Quantum Auth Client Library
 */
function checkUserSession() {
    const token = localStorage.getItem('qi_token');
    return !!token;
}

function logoutUser() {
    localStorage.removeItem('qi_token');
    window.location.href = 'login.html';
}
