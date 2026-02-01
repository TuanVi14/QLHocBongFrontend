import React, { useState, useEffect, useCallback } from 'react';
import { getManagerContract, getTokenContract, MANAGER_ADDRESS } from '../services/eth';
import { ethers } from 'ethers';

// --- CẤU HÌNH ADMIN (Thay bằng ví của bạn nếu khác) ---
const ADMIN_WALLET = "0x21143185aBb050330F6Da0B5c3f1089A0ab6De93".toLowerCase();

const STATUS_MAP = ["Đã tạo", "Đã nộp", "Đã duyệt", "Đã thanh toán"];
const STATUS_COLOR = ["gray", "blue", "orange", "green"];

const AdminDashboard = () => {
    // --- STATE ---
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [form, setForm] = useState({ name: '', amount: '', slots: '', desc: '', deadlineDate: '' });

    const [scholarships, setScholarships] = useState([]); 
    const [selectedId, setSelectedId] = useState(null);   
    const [applicants, setApplicants] = useState([]);     
    const [loadingList, setLoadingList] = useState(false); 
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [viewingApp, setViewingApp] = useState(null);

    // State kiểm tra quyền Admin
    const [currentAccount, setCurrentAccount] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    // ==========================================
    // 1. KIỂM TRA QUYỀN ADMIN
    // ==========================================
    useEffect(() => {
        const checkAuth = async () => {
            if (window.ethereum) {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    const account = accounts[0].toLowerCase();
                    setCurrentAccount(account);
                    // Chỉ set là Admin nếu ví trùng khớp
                    setIsAdmin(account === ADMIN_WALLET);
                } else {
                    setIsAdmin(false);
                }
            }
        };
        checkAuth();

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    const account = accounts[0].toLowerCase();
                    setCurrentAccount(account);
                    setIsAdmin(account === ADMIN_WALLET);
                } else {
                    setIsAdmin(false);
                    setCurrentAccount("");
                }
            });
        }
    }, []);

    // ==========================================
    // 2. CÁC HÀM XỬ LÝ (HELPER)
    // ==========================================
    
    // Xử lý link IPFS để không bị lỗi 500
    const getGatewayLink = (ipfsUrl) => {
        if (!ipfsUrl) return "#";
        // Nếu là hash giả lập (Demo) -> Trả về PDF mẫu
        if (ipfsUrl.includes("QmHoso") || ipfsUrl.includes("_")) {
            return "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
        }
        // Nếu là hash thật -> Dùng Gateway
        return ipfsUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
    };

    const parseStudentInfo = (metadata) => {
        try {
            const parts = metadata.split('_');
            if (parts.length >= 2) {
                return {
                    studentId: parts[1], 
                    submitTime: new Date(Number(parts[2])).toLocaleString('vi-VN') 
                };
            }
        } catch (e) {}
        return { studentId: "Unknown", submitTime: "N/A" };
    };

    // ==========================================
    // 3. LOGIC TẢI DỮ LIỆU
    // ==========================================
    const fetchScholarships = useCallback(async () => {
        try {
            const manager = await getManagerContract();
            if (!manager) return;

            const count = await manager.nextScholarshipId();
            const items = [];
            
            for (let i = Number(count) - 1; i >= 0; i--) {
                const s = await manager.scholarships(i);
                
                // Lấy dữ liệu chính xác từ Contract mới
                const id = Number(s.id);
                const totalSlots = Number(s.slots);
                const filled = Number(s.filledSlots); 
                const remaining = Math.max(0, totalSlots - filled);

                items.push({
                    id: id,
                    title: s.title,
                    amount: s.amount, 
                    totalApplicants: Number(s.totalApplicants),
                    remainingSlots: remaining,
                    originalSlots: totalSlots
                });
            }
            setScholarships(items);
        } catch (error) {
            console.error("Lỗi tải danh sách:", error);
        }
    }, []);

    useEffect(() => {
        fetchScholarships();
    }, [fetchScholarships]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        setScholarships([]); 
        await new Promise(r => setTimeout(r, 500));
        await fetchScholarships();
        setIsRefreshing(false);
    };

    const handleSelectScholarship = async (schId, total) => {
        setSelectedId(schId);
        setLoadingList(true);
        setApplicants([]);

        if (total === 0) {
            setLoadingList(false);
            return;
        }

        try {
            const manager = await getManagerContract();
            const apps = [];
            for (let i = 0; i < total; i++) {
                const app = await manager.applications(schId, i);
                apps.push({
                    index: i,
                    applicant: app.applicant || app[0], 
                    metadata: app.metadata || app[1],  
                    status: Number(app.status !== undefined ? app.status : app[2]) 
                });
            }
            setApplicants(apps);
        } catch (error) {
            console.error("Lỗi tải ứng viên:", error);
        } finally {
            setLoadingList(false);
        }
    };

    // ==========================================
    // 4. CHỨC NĂNG ADMIN (TẠO, DUYỆT, TRẢ TIỀN)
    // ==========================================
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        
        if (!isAdmin) return alert("⛔ Bạn không phải Admin!");
        if (!form.name || !form.amount || !form.slots || !form.deadlineDate) return alert("Thiếu thông tin!");

        try {
            setIsLoading(true);
            const dateObj = new Date(form.deadlineDate);
            dateObj.setHours(23, 59, 59, 999); 
            const deadlineTimestamp = Math.floor(dateObj.getTime() / 1000);

            if (deadlineTimestamp < Math.floor(Date.now() / 1000)) return alert("Ngày hết hạn lỗi!");

            const manager = await getManagerContract();
            const token = await getTokenContract();
            if (!manager || !token) return alert("Chưa kết nối ví!");

            const decimals = await token.decimals();
            // Xử lý số thập phân
            const amountWei = ethers.parseUnits(form.amount.toString(), decimals);
            const totalWei = amountWei * BigInt(form.slots);

            setStatus("⏳ B1: Approve...");
            const txApprove = await token.approve(MANAGER_ADDRESS, totalWei);
            await txApprove.wait();

            setStatus("⏳ B2: Tạo HB...");
            const txCreate = await manager.createScholarship(
                form.name, amountWei, BigInt(form.slots), BigInt(deadlineTimestamp), form.desc || "" 
            );
            await txCreate.wait();

            alert("✅ Tạo thành công! Trang sẽ tự tải lại...");
            
            // [TỰ ĐỘNG F5]
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert("Lỗi: " + (err.reason || err.message));
            setIsLoading(false);
            setStatus("");
        }
    };

    const handleApprove = async (index) => {
        if (!isAdmin) return alert("⛔ Bạn không phải Admin!");
        if (!window.confirm("Duyệt hồ sơ này?")) return;
        
        const currentS = scholarships.find(s => s.id === selectedId);
        if (currentS && currentS.remainingSlots <= 0) {
            return alert("❌ Học bổng này đã hết suất!");
        }

        try {
            const manager = await getManagerContract();
            const tx = await manager.approveApplicant(selectedId, index);
            await tx.wait();
            
            alert("✅ Đã duyệt thành công!");
            
            // [TỰ ĐỘNG F5]
            window.location.reload(); 

        } catch (e) {
            alert("Lỗi: " + (e.reason || e.message));
        }
    };

    const handlePay = async (index) => {
        if (!isAdmin) return alert("⛔ Bạn không phải Admin!");
        if (!window.confirm("Chuyển tiền?")) return;
        try {
            const manager = await getManagerContract();
            const tx = await manager.payApplicant(selectedId, index);
            await tx.wait();
            
            alert("✅ Đã chuyển tiền!");
            
            // [TỰ ĐỘNG F5]
            window.location.reload();
            
        } catch (e) {
            alert("Lỗi: " + (e.reason || e.message));
        }
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <div className="max-w-6xl mx-auto space-y-8 relative">
            
            {/* [ĐÃ XÓA CẢNH BÁO MÀU ĐỎ] */}

            {/* FORM TẠO (CHỈ HIỆN KHI LÀ ADMIN) */}
            {isAdmin ? (
                <div className="p-8 bg-white rounded-2xl shadow-xl border border-indigo-50">
                    <h2 className="text-3xl font-bold mb-6 text-indigo-800 flex items-center gap-3">
                        <span className="bg-indigo-100 p-2 rounded-lg text-2xl">🎓</span> Tạo Học Bổng Mới
                    </h2>
                    <form onSubmit={handleCreateSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Tên chương trình</label>
                            <input className="w-full border border-gray-300 p-3 rounded-lg outline-none" 
                                placeholder="VD: Học bổng 2024" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">Giá trị (WCT)</label>
                                {/* [QUAN TRỌNG] step="any" để nhập số lẻ */}
                                <input type="number" step="any" min="0" className="w-full border border-gray-300 p-3 rounded-lg" 
                                    value={form.amount} onChange={e => e.target.value >= 0 && setForm({...form, amount: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-2">Số lượng</label>
                                <input type="number" min="1" className="w-full border border-gray-300 p-3 rounded-lg" 
                                    value={form.slots} onChange={e => (e.target.value === '' || e.target.value >= 0) && setForm({...form, slots: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-red-600 mb-2">Hạn chót</label>
                                <input type="date" min={today} className="w-full border border-gray-300 p-3 rounded-lg"
                                    value={form.deadlineDate} onChange={e => setForm({...form, deadlineDate: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">Mô tả</label>
                            <textarea className="w-full border border-gray-300 p-3 rounded-lg h-24" 
                                value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
                        </div>
                        <button disabled={isLoading} className={`w-full py-3 text-white font-bold rounded-xl shadow-md transition 
                            ${isLoading ? 'bg-gray-400' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg'}`}>
                            {isLoading ? status : "🚀 Tạo Học Bổng & Nạp Quỹ"}
                        </button>
                    </form>
                </div>
            ) : null}

            {/* DANH SÁCH QUẢN LÝ */}
            <div className="p-6 bg-white rounded-2xl shadow-lg border border-indigo-50">
                <div className="flex justify-between items-center border-b pb-4 mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        📂 Quản Lý Hồ Sơ
                    </h2>
                    <button onClick={handleManualRefresh} disabled={isRefreshing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold text-sm border 
                        ${isRefreshing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200'}`}>
                        {isRefreshing ? "Đang cập nhật..." : "Làm mới danh sách"}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                    {/* CỘT TRÁI */}
                    <div className="lg:col-span-1 border-r border-gray-100 pr-4 overflow-y-auto custom-scrollbar space-y-3">
                        {scholarships.length === 0 && (
                            <div className="text-center mt-10">
                                {isRefreshing ? <p className="text-indigo-500 animate-pulse">Đang tải...</p> : <p className="text-gray-400">Trống</p>}
                            </div>
                        )}
                        {scholarships.map(s => (
                            <div key={s.id} onClick={() => handleSelectScholarship(s.id, s.totalApplicants)}
                                className={`p-4 rounded-xl cursor-pointer border transition hover:shadow-md ${selectedId === s.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-300'}`}>
                                <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{s.title}</h4>
                                <div className="flex justify-between mt-2 text-xs text-gray-500">
                                    <span>ID: #{s.id}</span>
                                    <span className={`px-2 py-0.5 rounded font-bold ${s.remainingSlots > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                                        Còn: {s.remainingSlots}/{s.originalSlots} suất
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CỘT PHẢI */}
                    <div className="lg:col-span-2 pl-2 overflow-y-auto custom-scrollbar">
                        {selectedId === null ? (
                            <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                👈 Chọn học bổng để xem
                            </div>
                        ) : (
                            <div>
                                <h3 className="font-bold text-lg mb-4 text-gray-700 sticky top-0 bg-white z-10 py-2 border-b">
                                    Danh sách ứng viên (ID: {selectedId})
                                </h3>
                                {loadingList ? (
                                    <p className="text-center text-indigo-500 mt-10 font-medium">Đang tải...</p>
                                ) : applicants.length === 0 ? (
                                    <div className="text-center mt-10 p-6 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-gray-500 italic">Chưa có hồ sơ.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold text-gray-600">
                                                <tr>
                                                    <th className="px-4 py-3">MSSV</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3 text-right">Chi tiết</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {applicants.map((app) => {
                                                    const info = parseStudentInfo(app.metadata);
                                                    return (
                                                        <tr key={app.index} className="hover:bg-gray-50 transition">
                                                            <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">
                                                                {info.studentId}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold bg-${STATUS_COLOR[app.status]}-100 text-${STATUS_COLOR[app.status]}-700`}>
                                                                    {STATUS_MAP[app.status]}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <button onClick={() => setViewingApp(app)}
                                                                    className="text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 ml-auto">
                                                                    👁️ Xem
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- MODAL CHI TIẾT --- */}
            {viewingApp && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-up">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold">Chi Tiết Hồ Sơ</h3>
                                <p className="text-indigo-100 text-sm mt-1">ID: #{viewingApp.index}</p>
                            </div>
                            <button onClick={() => setViewingApp(null)} className="text-white hover:bg-white/20 rounded-full p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="bg-blue-100 p-2 rounded-full text-blue-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>
                                <div><p className="text-xs text-gray-500 uppercase font-bold">Mã Sinh Viên</p><p className="font-bold text-gray-800 text-lg">{parseStudentInfo(viewingApp.metadata).studentId}</p></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100"><p className="text-xs text-gray-500 uppercase font-bold">Ví</p><p className="font-mono text-xs text-gray-600 mt-1 truncate" title={viewingApp.applicant}>{viewingApp.applicant.slice(0,10)}...</p></div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100"><p className="text-xs text-gray-500 uppercase font-bold">Thời gian</p><p className="text-sm text-gray-800 mt-1">{parseStudentInfo(viewingApp.metadata).submitTime}</p></div>
                            </div>

                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 flex justify-between items-center">
                                <div><p className="text-xs text-indigo-500 uppercase font-bold">File</p><p className="text-xs text-indigo-400 truncate max-w-[150px]">{viewingApp.metadata}</p></div>
                                <a href={getGatewayLink(viewingApp.metadata)} target="_blank" rel="noreferrer" className="bg-white text-indigo-600 px-3 py-1.5 rounded text-sm font-bold shadow-sm">Mở ↗</a>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                                <span className={`px-3 py-1 rounded-full text-sm font-bold bg-${STATUS_COLOR[viewingApp.status]}-100 text-${STATUS_COLOR[viewingApp.status]}-700`}>
                                    {STATUS_MAP[viewingApp.status]}
                                </span>
                                
                                {isAdmin && (
                                    <div className="space-x-2">
                                        {viewingApp.status === 1 && <button onClick={() => handleApprove(viewingApp.index)} className="bg-orange-500 text-white px-3 py-2 rounded font-bold text-sm shadow">Duyệt</button>}
                                        {viewingApp.status === 2 && <button onClick={() => handlePay(viewingApp.index)} className="bg-green-600 text-white px-3 py-2 rounded font-bold text-sm shadow">Chuyển Tiền</button>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;