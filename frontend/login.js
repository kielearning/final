document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const notification = document.getElementById('notification');
    const loginButton = document.querySelector('.btn-primary');

    const showNotification = (message, type) => {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginButton.disabled = true;
        loginButton.textContent = 'Loading...';
        notification.style.display = 'none';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);

            // Logika role SUDAH BENAR di sini
            if (data.role === 'supervisor') {
                window.location.href = 'supervisor.html';
            } else {
                window.location.href = 'karyawan.html';
            }
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
        // BAGIAN YANG DOBEL DI SINI SUDAH DIHAPUS
    });
});