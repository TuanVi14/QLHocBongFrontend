import React, { useState, useEffect, useCallback } from 'react';
import { getManagerContract, getTokenContract, MANAGER_ADDRESS } from '../services/eth';
import { ethers } from 'ethers';

// Định nghĩa trạng thái cho phần duyệt
const STATUS_MAP = ["Đã tạo", "Đã nộp", "Đã duyệt", "Đã thanh toán"];
const STATUS_COLOR = ["gray", "blue", "orange", "green"];

const AdminDashboard = () => {
    // --- STATE CHO FORM TẠO HỌC BỔNG ---
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [form, setForm] = useState({ 
        name: '', 
        amount: '', 
        slots: '', 
        desc: '',
        deadlineDate: '' 
    });

    // --- STATE CHO PHẦN QUẢN LÝ & DUYỆT ---
    const [scholarships, setScholarships] = useState([]); // Danh sách học bổng
    const [selectedId, setSelectedId] = useState(null);   // ID đang chọn để xem ứng viên
    const [applicants, setApplicants] = useState([]);     // Danh sách ứng viên
    const [loadingList, setLoadingList] = useState(false); // Loading cho danh sách

    // ==========================================
    // PHẦN 1: LOGIC TẢI DỮ LIỆU (READ)
    // ==========================================

    // Hàm tải danh sách học bổng từ Blockchain
    const fetchScholarships = useCallback(async () => {
        try {
            const manager = await getManagerContract();
            if (!manager) return;

            const count = await manager.nextScholarshipId();
            const items = [];
            // Lấy từ mới nhất về cũ nhất
            for (let i = Number(count) - 1; i >= 0; i--) {
                const s = await manager.scholarships(i);
                items.push({
                    id: Number(s.id),
                    title: s.title,
                    amount: s.amount, // Wei
                    totalApplicants: Number(s.totalApplicants)
                });
            }
            setScholarships(items);
        } catch (error) {
            console.error("Lỗi tải danh sách:", error);
        }
    }, []);

    // Tải danh sách khi mới vào trang
    useEffect(() => {
        fetchScholarships();
    }, [fetchScholarships]);

    // Hàm tải ứng viên khi bấm vào một học bổng
    const handleSelectScholarship = async (schId, total) => {
        setSelectedId(schId);
        setLoadingList(true);
        setApplicants([]);

        try {
            const manager = await getManagerContract();
            const apps = [];
            for (let i = 0; i < total; i++) {
                const app = await manager.applications(schId, i);
                apps.push({
                    index: i,
                    applicant: app.applicant,
                    metadata: app.metadata,
                    status: Number(app.status)
                });
            }
            setApplicants(apps);
        } catch (error) {
            console.error(error);
            alert("Lỗi tải danh sách ứng viên");
        } finally {
            setLoadingList(false);
        }
    };

    // ==========================================
    // PHẦN 2: LOGIC TẠO HỌC BỔNG (CREATE)
    // ==========================================
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.amount || !form.slots || !form.deadlineDate) return alert("Vui lòng nhập đủ thông tin!");

        try {
            setIsLoading(true);
            
            const dateObj = new Date(form.deadlineDate);
            dateObj.setHours(23, 59, 59, 999); 
            const deadlineTimestamp = Math.floor(dateObj.getTime() / 1000);

            if (deadlineTimestamp < Math.floor(Date.now() / 1000)) {
                return alert("Ngày hết hạn phải ở tương lai!");
            }

            const manager = await getManagerContract();
            const token = await getTokenContract();
            if (!manager || !token) return alert("Chưa kết nối ví!");

            const decimals = await token.decimals();
            const amountWei = ethers.parseUnits(form.amount, decimals);
            const totalWei = amountWei * BigInt(form.slots);

            setStatus("⏳ B1: Đang xác nhận quyền chuyển Token...");
            const txApprove = await token.approve(MANAGER_ADDRESS, totalWei);
            await txApprove.wait();

            setStatus("⏳ B2: Đang tạo học bổng trên Blockchain...");
            
            // Lưu ý: Smart contract phải hỗ trợ tham số thứ 5 là description
            const txCreate = await manager.createScholarship(
                form.name,
                amountWei,
                BigInt(form.slots),
                BigInt(deadlineTimestamp),
                form.desc || "" 
            );
            await txCreate.wait();

            alert("✅ Đã tạo học bổng thành công!");
            setForm({ name: '', amount: '', slots: '', desc: '', deadlineDate: '' });
            
            // Tải lại danh sách bên dưới ngay lập tức
            fetchScholarships();

        } catch (err) {
            console.error(err);
            alert("Lỗi: " + (err.reason || err.message));
        } finally {
            setIsLoading(false);
            setStatus("");
        }
    };

    // ==========================================
    // PHẦN 3: LOGIC DUYỆT & TRẢ TIỀN (APPROVE/PAY)
    // ==========================================
    
    const handleApprove = async (index) => {
        if (!window.confirm("Xác nhận duyệt hồ sơ này?")) return;
        try {
            const manager = await getManagerContract();
            const tx = await manager.approveApplicant(selectedId, index);
            await tx.wait();
            alert("✅ Đã duyệt hồ sơ!");
            // Refresh danh sách ứng viên
            const s = scholarships.find(x => x.id === selectedId);
            handleSelectScholarship(selectedId, s.totalApplicants);
        } catch (e) {
            alert("Lỗi: " + (e.reason || e.message));
        }
    };

    const handlePay = async (index) => {
        if (!window.confirm("Xác nhận chuyển tiền học bổng cho ví này?")) return;
        try {
            const manager = await getManagerContract();
            const tx = await manager.payApplicant(selectedId, index);
            await tx.wait();
            alert("✅ Đã chuyển tiền thành công!");
            // Refresh danh sách ứng viên
            const s = scholarships.find(x => x.id === selectedId);
            handleSelectScholarship(selectedId, s.totalApplicants);
        } catch (e) {
            alert("Lỗi: " + (e.reason || e.message));
        }
    };

    const today = new Date().toISOString().split("T")[0];

    // ==========================================
    // GIAO DIỆN (RENDER)
    // ==========================================
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            
            {/* --- BLOCK 1: FORM TẠO HỌC BỔNG --- */}
            <div className="p-8 bg-white rounded-2xl shadow-xl border border-indigo-50">
                <h2 className="text-3xl font-bold mb-6 text-indigo-800 flex items-center gap-3">
                    <span className="bg-indigo-100 p-2 rounded-lg text-2xl">🎓</span>
                    Tạo Học Bổng Mới
                </h2>
                
                <form onSubmit={handleCreateSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">Tên chương trình</label>
                        <input 
                            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                            placeholder="VD: Học bổng Thắp Sáng Ước Mơ 2024" 
                            value={form.name} onChange={e => setForm({...form, name: e.target.value})} 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Giá trị (WCT/Suất)</label>
                            <input type="number" className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                                placeholder="1000" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Số lượng</label>
                            <input type="number" className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                                placeholder="5" value={form.slots} onChange={e => setForm({...form, slots: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-red-600 mb-2">📅 Hạn chót</label>
                            <input type="date" min={today} className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={form.deadlineDate} onChange={e => setForm({...form, deadlineDate: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">Mô tả</label>
                        <textarea className="w-full border border-gray-300 p-3 rounded-lg h-24 focus:ring-2 focus:ring-indigo-500 outline-none" 
                            placeholder="Mô tả chi tiết..."
                            value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
                    </div>

                    <button disabled={isLoading} className={`w-full py-3 text-white font-bold rounded-xl shadow-md transition transform active:scale-95 
                        ${isLoading ? 'bg-gray-400' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg'}`}>
                        {isLoading ? status : "🚀 Tạo Học Bổng & Nạp Quỹ"}
                    </button>
                </form>
            </div>

            {/* --- BLOCK 2: QUẢN LÝ & DUYỆT HỒ SƠ --- */}
            <div className="p-6 bg-white rounded-2xl shadow-lg border border-indigo-50">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                    📂 Danh Sách & Duyệt Hồ Sơ
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                    
                    {/* CỘT TRÁI: DANH SÁCH HỌC BỔNG */}
                    <div className="lg:col-span-1 border-r border-gray-100 pr-4 overflow-y-auto custom-scrollbar space-y-3">
                        {scholarships.length === 0 && <p className="text-center text-gray-400 mt-10">Chưa có học bổng nào.</p>}
                        
                        {scholarships.map(s => (
                            <div 
                                key={s.id}
                                onClick={() => handleSelectScholarship(s.id, s.totalApplicants)}
                                className={`p-4 rounded-xl cursor-pointer border transition hover:shadow-md
                                    ${selectedId === s.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'}
                                `}
                            >
                                <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{s.title}</h4>
                                <div className="flex justify-between mt-2 text-xs text-gray-500">
                                    <span>ID: #{s.id}</span>
                                    <span className={`px-2 py-0.5 rounded font-bold ${s.totalApplicants > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {s.totalApplicants} hồ sơ
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CỘT PHẢI: CHI TIẾT ỨNG VIÊN */}
                    <div className="lg:col-span-2 pl-2 overflow-y-auto custom-scrollbar">
                        {selectedId === null ? (
                            <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                👈 Chọn một học bổng bên trái để xem danh sách nộp
                            </div>
                        ) : (
                            <div>
                                <h3 className="font-bold text-lg mb-4 text-gray-700 sticky top-0 bg-white z-10 py-2">
                                    Danh sách ứng viên (ID: {selectedId})
                                </h3>
                                
                                {loadingList ? (
                                    <p className="text-indigo-500 text-sm animate-pulse text-center mt-10">Đang tải dữ liệu từ Blockchain...</p>
                                ) : applicants.length === 0 ? (
                                    <p className="text-gray-500 italic text-center mt-10">Chưa có sinh viên nào nộp hồ sơ.</p>
                                ) : (
                                    <div className="overflow-hidden rounded-lg border border-gray-200">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3">Ví Sinh Viên</th>
                                                    <th className="px-4 py-3">Link Hồ Sơ</th>
                                                    <th className="px-4 py-3">Trạng thái</th>
                                                    <th className="px-4 py-3 text-right">Hành động</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {applicants.map((app) => (
                                                    <tr key={app.index} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-3 font-mono text-xs text-gray-600" title={app.applicant}>
                                                            {app.applicant.slice(0, 6)}...{app.applicant.slice(-4)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <a href={app.metadata.replace("ipfs://", "https://ipfs.io/ipfs/")} 
                                                               target="_blank" rel="noreferrer"
                                                               className="text-indigo-600 hover:underline flex items-center gap-1 max-w-[120px] truncate"
                                                            >
                                                                📄 Xem
                                                            </a>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold bg-${STATUS_COLOR[app.status]}-100 text-${STATUS_COLOR[app.status]}-700`}>
                                                                {STATUS_MAP[app.status]}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right space-x-2">
                                                            {/* Nút DUYỆT (Hiện khi status = 1: Đã nộp) */}
                                                            {app.status === 1 && (
                                                                <button onClick={() => handleApprove(app.index)}
                                                                    className="bg-orange-500 text-white px-3 py-1.5 rounded hover:bg-orange-600 transition text-xs font-bold shadow">
                                                                    Duyệt
                                                                </button>
                                                            )}

                                                            {/* Nút TRAO TIỀN (Hiện khi status = 2: Đã duyệt) */}
                                                            {app.status === 2 && (
                                                                <button onClick={() => handlePay(app.index)}
                                                                    className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition text-xs font-bold shadow">
                                                                    💸 Trao Tiền
                                                                </button>
                                                            )}

                                                            {app.status === 3 && (
                                                                <span className="text-green-600 font-bold text-xs flex items-center justify-end gap-1">
                                                                    ✔ Hoàn tất
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;