document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const notification = document.getElementById('notification');
    const registerButton = document.querySelector('.btn-primary');

    const showNotification = (message, type) => {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
    };

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerButton.disabled = true;
        registerButton.textContent = 'Loading...';
        notification.style.display = 'none';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('http://localhost:3000/api/daftar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            showNotification(data.message, 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } catch (error) {
            showNotification(error.message, 'error');
            registerButton.disabled = false;
            registerButton.textContent = 'Daftar';
        }
    });
});