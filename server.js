// File: backend/server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // Menggunakan SQLite
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const JWT_SECRET = 'kunci-rahasia-sistem-absensi-pegadaian-anda';

// Middleware
app.use(cors());
app.use(express.json());

// Koneksi ke database file SQLite
const db = new sqlite3.Database('./pegadaian.db', (err) => {
    if (err) {
        console.error("Error membuka database:", err.message);
    } else {
        console.log('Terhubung ke database SQLite.');
        // Membuat tabel secara otomatis jika belum ada
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'karyawan',
                sisa_cuti INTEGER NOT NULL DEFAULT 12
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS pengajuan_absensi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                tipe_absensi TEXT NOT NULL,
                tanggal_mulai TEXT NOT NULL,
                tanggal_selesai TEXT NOT NULL,
                keterangan TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`);
        });
    }
});

// === Endpoint Pendaftaran ===
app.post('/api/daftar', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 4) {
        return res.status(400).json({ message: 'Username dan password (min 4 karakter) diperlukan.' });
    }

    db.get("SELECT id FROM users WHERE username = ?", [username], async (err, row) => {
        if (err) return res.status(500).json({ message: 'Server error saat pendaftaran.' });
        if (row) return res.status(409).json({ message: 'Username sudah digunakan.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (username, password, role) VALUES (?, ?, 'karyawan')", [username, hashedPassword], function(err) {
            if (err) return res.status(500).json({ message: 'Gagal menyimpan user.' });
            res.status(201).json({ message: 'Pendaftaran berhasil! Silakan login.' });
        });
    });
});

// === Endpoint Login ===
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) return res.status(500).json({ message: 'Server error saat login.' });
        if (!user) return res.status(401).json({ message: 'Username atau Password salah.' });

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) return res.status(401).json({ message: 'Username atau Password salah.' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login berhasil!', token, role: user.role, username: user.username });
        
    
    
    });
});

// === Middleware Otentikasi Token ===
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// === Endpoint Dasbor Karyawan ===
app.get('/api/karyawan/dashboard', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.get("SELECT sisa_cuti FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) return res.status(500).json({ message: 'Server error.' });
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });

        db.all("SELECT * FROM pengajuan_absensi WHERE user_id = ? ORDER BY tanggal_mulai DESC", [userId], (err, riwayat) => {
            if (err) return res.status(500).json({ message: 'Gagal memuat riwayat.' });
            
            const stats = { cuti_digunakan: 0, menunggu_persetujuan: 0 };
            riwayat.forEach(req => {
                const days = Math.ceil((new Date(req.tanggal_selesai) - new Date(req.tanggal_mulai)) / (1000 * 60 * 60 * 24)) + 1;
                if (req.status === 'approved' && req.tipe_absensi === 'cuti') stats.cuti_digunakan += days;
                if (req.status === 'pending') stats.menunggu_persetujuan++;
            });

            res.json({
                sisa_cuti: user.sisa_cuti,
                cuti_digunakan: stats.cuti_digunakan,
                menunggu_persetujuan: stats.menunggu_persetujuan,
                riwayat: riwayat
            });
        });
    });
});

// === Endpoint Pengajuan Cuti/Izin ===
app.post('/api/pengajuan', authenticateToken, (req, res) => {
    const { type, startDate, endDate, reason } = req.body;
    const userId = req.user.id;
    const query = "INSERT INTO pengajuan_absensi (user_id, tipe_absensi, tanggal_mulai, tanggal_selesai, keterangan) VALUES (?, ?, ?, ?, ?)";
    db.run(query, [userId, type, startDate, endDate, reason], function(err) {
        if (err) return res.status(500).json({ message: 'Gagal membuat pengajuan.' });
        res.status(201).json({ message: 'Pengajuan berhasil dibuat.' });
    });
});

// === Endpoint Dasbor Supervisor ===
app.get('/api/supervisor/requests', authenticateToken, (req, res) => {
    if (req.user.role !== 'supervisor') return res.status(403).json({ message: 'Akses ditolak.' });
    const query = `
        SELECT p.id, u.username, p.tipe_absensi, p.tanggal_mulai, p.tanggal_selesai, p.keterangan 
        FROM pengajuan_absensi p JOIN users u ON p.user_id = u.id 
        WHERE p.status = 'pending' ORDER BY p.created_at ASC`;
    db.all(query, [], (err, requests) => {
        if (err) return res.status(500).json({ message: 'Gagal memuat permintaan.' });
        res.json(requests);
    });
});

// === Endpoint Aksi Supervisor (Approve/Reject) ===
app.put('/api/requests/:id/status', authenticateToken, (req, res) => {
    if (req.user.role !== 'supervisor') return res.status(403).json({ message: 'Akses ditolak.' });
    
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Status tidak valid.' });

    db.get("SELECT * FROM pengajuan_absensi WHERE id = ? AND status = 'pending'", [id], (err, request) => {
        if (err) return res.status(500).json({ message: 'Server error.' });
        if (!request) return res.status(404).json({ message: 'Pengajuan tidak ditemukan atau sudah diproses.' });

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            db.run("UPDATE pengajuan_absensi SET status = ? WHERE id = ?", [status, id]);

            if (status === 'approved' && request.tipe_absensi === 'cuti') {
                const days = Math.ceil((new Date(request.tanggal_selesai) - new Date(request.tanggal_mulai)) / (1000 * 60 * 60 * 24)) + 1;
                db.run("UPDATE users SET sisa_cuti = sisa_cuti - ? WHERE id = ?", [days, request.user_id]);
            }
            
            db.run("COMMIT", (commitErr) => {
                 if(commitErr) {
                     db.run("ROLLBACK");
                     return res.status(500).json({ message: 'Gagal memproses permintaan.' });
                 }
                 res.json({ message: `Pengajuan berhasil di-${status}` });
            });
        });
    });
});

// Menjalankan Server
app.listen(port, () => {
    console.log(`Server backend berjalan di http://localhost:${port}`);
});