document.addEventListener('DOMContentLoaded', () => {
    // === Keamanan & Inisialisasi ===
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');

    if (!token) {
        window.location.href = 'index.html'; // Jika tidak ada token, kembali ke login
        return;
    }
    document.getElementById('userName').textContent = username;

    // === Variabel Elemen DOM ===
    const leaveBalanceEl = document.getElementById('leaveBalance');
    const leaveTakenEl = document.getElementById('leaveTaken');
    const leavePendingEl = document.getElementById('leavePending');
    const historyTable = document.getElementById('employeeHistoryTable').querySelector('tbody');
    const form = document.getElementById('leaveRequestForm');
    const notification = document.getElementById('notification');
    const MIN_LEAVE_NOTICE_DAYS = 7; // Aturan pengajuan cuti H-7

    // === Fungsi Bantuan ===
    const showNotification = (message, type) => {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        setTimeout(() => { notification.style.display = 'none'; }, 4000);
    };

    const calculateDays = (start, end) => {
        const diffTime = new Date(end) - new Date(start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    };

    // === Fungsi Utama: Mengambil Data dari Server ===
    async function loadDashboardData() {
        try {
            const response = await fetch('http://localhost:3000/api/karyawan/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if(response.status === 403 || response.status === 401) window.location.href = 'index.html';
                throw new Error('Gagal memuat data dasbor.');
            }
            const data = await response.json();

            // Mengisi kartu statistik
            leaveBalanceEl.textContent = data.sisa_cuti;
            leaveTakenEl.textContent = data.cuti_digunakan;
            leavePendingEl.textContent = data.menunggu_persetujuan;

            // Mengisi tabel riwayat
            historyTable.innerHTML = ''; // Kosongkan tabel sebelum diisi
            if (data.riwayat.length === 0) {
                historyTable.innerHTML = `<tr><td colspan="4" style="text-align: center;">Belum ada riwayat pengajuan.</td></tr>`;
            } else {
                data.riwayat.forEach(req => {
                    const days = calculateDays(req.tanggal_mulai, req.tanggal_selesai);
                    const row = historyTable.insertRow();
                    row.innerHTML = `
                        <td>${req.tipe_absensi}</td>
                        <td>${new Date(req.tanggal_mulai).toLocaleDateString('id-ID')}</td>
                        <td>${days} hari</td>
                        <td><span class="status status-${req.status}">${req.status}</span></td>
                    `;
                });
            }
        } catch (error) {
            console.error('Error memuat data:', error);
            alert(error.message);
        }
    }

    // === Event Listener untuk Form Pengajuan ===
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button');

        // Validasi frontend
        const type = document.getElementById('requestType').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (new Date(endDate) < new Date(startDate)) {
            showNotification('Tanggal selesai tidak boleh sebelum tanggal mulai.', 'error');
            return;
        }

        if (type === 'cuti') {
            const today = new Date();
            const requestDate = new Date(startDate);
            const noticePeriod = new Date();
            noticePeriod.setDate(today.getDate() + MIN_LEAVE_NOTICE_DAYS);
            
            if (requestDate < noticePeriod) {
                showNotification(`Pengajuan cuti harus minimal ${MIN_LEAVE_NOTICE_DAYS} hari dari sekarang.`, 'error');
                return;
            }
        }

        const requestData = {
            type: type,
            startDate: startDate,
            endDate: endDate,
            reason: document.getElementById('reason').value
        };

        submitButton.disabled = true;
        submitButton.textContent = 'Mengirim...';

        try {
            const response = await fetch('http://localhost:3000/api/pengajuan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            showNotification('Pengajuan berhasil dikirim!', 'success');
            form.reset();
            loadDashboardData(); // Muat ulang data untuk menampilkan pengajuan baru
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Kirim Pengajuan';
        }
    });
    
    // Event listener untuk logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // Panggil fungsi utama saat halaman dimuat
    loadDashboardData();
});