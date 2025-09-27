document.addEventListener('DOMContentLoaded', () => {
    // === Keamanan & Inisialisasi ===
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('userName').textContent = username;

    // === Variabel Elemen DOM ===
    const requestTable = document.getElementById('supervisorRequestTable').querySelector('tbody');

    // === Fungsi Utama: Mengambil Data dari Server ===
    async function loadSupervisorData() {
        try {
            const response = await fetch('http://localhost:3000/api/supervisor/requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                 if(response.status === 403 || response.status === 401) window.location.href = 'index.html';
                 throw new Error('Gagal memuat data pengajuan.');
            }
            const requests = await response.json();
            
            requestTable.innerHTML = '';
            if (requests.length === 0) {
                requestTable.innerHTML = `<tr><td colspan="5" style="text-align: center;">Tidak ada pengajuan yang perlu ditinjau.</td></tr>`;
            } else {
                requests.forEach(req => {
                    const row = requestTable.insertRow();
                    row.innerHTML = `
                        <td>${req.username}</td>
                        <td>${req.tipe_absensi}</td>
                        <td>${new Date(req.tanggal_mulai).toLocaleDateString('id-ID')} s/d ${new Date(req.tanggal_selesai).toLocaleDateString('id-ID')}</td>
                        <td>${req.keterangan}</td>
                        <td class="action-buttons">
                            <button class="btn-approve" data-id="${req.id}">Approve</button>
                            <button class="btn-reject" data-id="${req.id}">Reject</button>
                        </td>
                    `;
                });
            }
        } catch (error) {
            console.error('Error memuat data:', error);
            alert(error.message);
        }
    }

    // === Event Listener untuk Tombol Aksi ===
    requestTable.addEventListener('click', async (e) => {
        if (e.target.matches('.btn-approve, .btn-reject')) {
            const id = e.target.dataset.id;
            const action = e.target.classList.contains('btn-approve') ? 'approved' : 'rejected';
            
            // Menonaktifkan tombol untuk mencegah klik ganda
            e.target.closest('.action-buttons').innerHTML = 'Memproses...';

            try {
                const response = await fetch(`http://localhost:3000/api/requests/${id}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: action })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                alert(`Pengajuan berhasil di-${action}.`);
                loadSupervisorData(); // Muat ulang data untuk refresh daftar
            } catch (error) {
                console.error('Error memproses aksi:', error);
                alert(error.message);
                loadSupervisorData(); // Muat ulang data meskipun gagal agar tombol muncul kembali
            }
        }
    });
    
    // Event listener untuk logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // Panggil fungsi utama saat halaman dimuat
    loadSupervisorData();
});