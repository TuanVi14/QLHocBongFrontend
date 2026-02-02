import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getManagerContract, getTokenContract, MANAGER_ADDRESS } from '../services/eth';
import { ethers } from 'ethers';

// --- CẤU HÌNH ---
const ADMIN_WALLET = "0x21143185aBb050330F6Da0B5c3f1089A0ab6De93".toLowerCase();
const STATUS_MAP = ["Đã tạo", "Chờ trường xác nhận", "Đã xác nhận (Chờ duyệt)", "Đã duyệt (Chờ tiền)", "Đã thanh toán", "Bị từ chối"];
const STATUS_COLOR = ["gray", "yellow", "blue", "orange", "green", "red"];

const AdminDashboard = () => {
    // --- STATE ---
    const [isLoading, setIsLoading] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [form, setForm] = useState({ name: '', amount: '', slots: '', desc: '', deadlineDate: '' });

    const [scholarships, setScholarships] = useState([]); 
    const [selectedId, setSelectedId] = useState(null);   
    const [applicants, setApplicants] = useState([]);     
    const [viewingApp, setViewingApp] = useState(null);
    const [loadingList, setLoadingList] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // QUYỀN HẠN
    const [currentAccount, setCurrentAccount] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [isVerifier, setIsVerifier] = useState(false);

    // QUẢN LÝ TRƯỜNG
    const [showVerifierModal, setShowVerifierModal] = useState(false); 
    const [verifierList, setVerifierList] = useState([]); 
    const [newVerifierInput, setNewVerifierInput] = useState(""); 

    // TÌM KIẾM HỌC BỔNG (Cột trái)
    const [searchTerm, setSearchTerm] = useState("");

    // [MỚI] TÌM KIẾM SINH VIÊN (Cột phải)
    const [applicantSearchTerm, setApplicantSearchTerm] = useState("");

    // Helper Parse Info (Đưa lên trên để dùng trong useMemo)
    const parseStudentInfo = (meta) => { 
        try { 
            const parts = meta.split('_');
            if (parts.length >= 2) {
                return { 
                    id: parts[1], // MSSV
                    time: new Date(Number(parts[2])).toLocaleString('vi-VN') 
                };
            }
        } catch {} 
        return { id: "Unknown", time: "N/A" }; 
    };

    // ==========================================
    // 1. AUTH & DATA
    // ==========================================
    const checkAuthAndData = useCallback(async () => {
        if (!window.ethereum) return;
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length === 0) return;
        
        const acc = accounts[0].toLowerCase();
        setCurrentAccount(acc);
        setIsAdmin(acc === ADMIN_WALLET);

        try {
            const manager = await getManagerContract();
            if (manager) {
                const isV = await manager.isVerifier(acc);
                setIsVerifier(isV);
            }
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        checkAuthAndData();
        if(window.ethereum) window.ethereum.on('accountsChanged', checkAuthAndData);
    }, [checkAuthAndData]);

    // ==========================================
    // 2. LOGIC QUẢN LÝ TRƯỜNG
    // ==========================================
    const fetchVerifierList = async () => {
        try {
            const manager = await getManagerContract();
            const list = await manager.getVerifierList();
            setVerifierList(list);
        } catch (e) { console.error(e); }
    };

    const handleAddVerifier = async () => {
        if (!isAdmin) return alert("⛔ Chỉ Admin mới được thêm!");
        if (!ethers.isAddress(newVerifierInput)) return alert("❌ Địa chỉ ví không hợp lệ!");
        try {
            const manager = await getManagerContract();
            const tx = await manager.addVerifier(newVerifierInput);
            await tx.wait();
            alert(`✅ Đã thêm trường: ${newVerifierInput}`);
            setNewVerifierInput("");
            fetchVerifierList();
        } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
    };

    const handleRemoveVerifier = async (addr) => {
        if (!isAdmin) return;
        if (!window.confirm(`Xóa quyền ví: ${addr}?`)) return;
        try {
            const manager = await getManagerContract();
            const tx = await manager.removeVerifier(addr);
            await tx.wait();
            alert("🗑️ Đã xóa!");
            fetchVerifierList();
        } catch (e) { alert("Lỗi: " + (e.reason || e.message)); }
    };

    // ==========================================
    // 3. LOGIC HỌC BỔNG (FETCH & SEARCH)
    // ==========================================
    const fetchScholarships = useCallback(async () => {
        const manager = await getManagerContract();
        if(!manager) return;
        const count = await manager.nextScholarshipId();
        const items = [];
        for (let i = Number(count) - 1; i >= 0; i--) {
            const s = await manager.scholarships(i);
            items.push({
                id: Number(s.id), 
                title: s.title, 
                amount: s.amount, 
                totalApplicants: Number(s.totalApplicants), 
                creator: (s.creator || "").toLowerCase(),
                remainingSlots: Number(s.slots) - Number(s.filledSlots), 
                originalSlots: Number(s.slots),
                deadline: Number(s.deadline)
            });
        }
        setScholarships(items);
    }, []);

    useEffect(() => { fetchScholarships(); }, [fetchScholarships]);

    // Logic Tìm kiếm Học bổng (Cột trái)
    const filteredScholarships = useMemo(() => {
        if (!searchTerm) return scholarships;
        const lower = searchTerm.toLowerCase();
        return scholarships.filter(s => 
            s.title.toLowerCase().includes(lower) || 
            s.id.toString().includes(lower)
        );
    }, [scholarships, searchTerm]);

    // [MỚI] Logic Tìm kiếm Ứng viên (Cột phải)
    const filteredApplicants = useMemo(() => {
        if (!applicantSearchTerm) return applicants;
        const lowerTerm = applicantSearchTerm.toLowerCase();
        return applicants.filter(app => {
            const info = parseStudentInfo(app.metadata);
            return (
                info.id.toLowerCase().includes(lowerTerm) || // Tìm theo MSSV
                app.applicant.toLowerCase().includes(lowerTerm) // Tìm theo Ví
            );
        });
    }, [applicants, applicantSearchTerm]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        setScholarships([]); 
        await new Promise(r => setTimeout(r, 500));
        await fetchScholarships();
        setIsRefreshing(false);
    };

    const handleSelectScholarship = async (id, total) => {
        setSelectedId(id); 
        setLoadingList(true); 
        setApplicants([]);
        setApplicantSearchTerm(""); // [MỚI] Reset tìm kiếm khi chuyển học bổng
        
        if(total === 0) { setLoadingList(false); return; }
        try {
            const manager = await getManagerContract();
            const apps = [];
            for(let i=0; i<total; i++) {
                const app = await manager.applications(id, i);
                apps.push({ index: i, applicant: app.applicant, metadata: app.metadata, status: Number(app.status) });
            }
            setApplicants(apps);
        } catch (error) { console.error(error); } 
        finally { setLoadingList(false); }
    };

    const handleWithdraw = async (e, schId) => {
        e.stopPropagation(); 
        if (!window.confirm("Rút toàn bộ tiền thừa của học bổng này về ví?")) return;
        try {
            const manager = await getManagerContract();
            const tx = await manager.withdrawRemainingFunds(schId);
            await tx.wait();
            alert("✅ Đã rút tiền thành công!");
            window.location.reload();
        } catch (err) { alert("Lỗi: " + (err.reason || err.message)); }
    };

    // ==========================================
    // 4. ACTION HANDLERS
    // ==========================================
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!isAdmin) return alert("⛔ Bạn không phải Admin!");
        if (Number(form.slots) <= 0 || Number(form.amount) < 0) return alert("❌ Số lượng/Giá trị không hợp lệ");

        try {
            setIsLoading(true); setStatusText("⏳ Đang xử lý...");
            const manager = await getManagerContract();
            const token = await getTokenContract();
            const dateObj = new Date(form.deadlineDate); dateObj.setHours(23,59,59);
            const decimals = await token.decimals();
            const amountWei = ethers.parseUnits(form.amount.toString(), decimals);
            
            await (await token.approve(MANAGER_ADDRESS, amountWei * BigInt(form.slots))).wait();
            setStatusText("⏳ Đang tạo trên Blockchain...");
            await (await manager.createScholarship(form.name, amountWei, BigInt(form.slots), BigInt(Math.floor(dateObj/1000)), form.desc||"")).wait();
            
            alert("✅ Thành công!"); window.location.reload();
        } catch(e) { alert("Lỗi: " + (e.reason || e.message)); } 
        finally { setIsLoading(false); setStatusText(""); }
    };

    const handleVerify = async (index, isValid) => {
        try {
            const manager = await getManagerContract();
            await (await manager.verifyApplicant(selectedId, index, isValid)).wait();
            alert(isValid ? "✅ Đã xác nhận!" : "❌ Đã từ chối!"); window.location.reload();
        } catch(e) { alert("Lỗi: " + (e.reason || e.message)); }
    };

    const handleApprove = async (index) => {
        try {
            const manager = await getManagerContract();
            await (await manager.approveApplicant(selectedId, index)).wait();
            alert("✅ Đã DUYỆT hồ sơ! Vui lòng bấm 'Trao tiền' để chuyển khoản."); window.location.reload();
        } catch(e) { alert("Lỗi: " + (e.reason || e.message)); }
    };

    const handlePay = async (index) => {
        try {
            const manager = await getManagerContract();
            await (await manager.payApplicant(selectedId, index)).wait();
            alert("✅ Tiền đã được chuyển thành công!"); window.location.reload();
        } catch(e) { alert("Lỗi: " + (e.reason || e.message)); }
    };
    
    // Helper Link
    const getGatewayLink = (url) => {
        if (!url) return "#";
        if (url.startsWith("http")) return url;
        if (url.includes("QmHoso") || url.includes("_")) return "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
        return url.replace("ipfs://", "https://ipfs.io/ipfs/");
    };
    
    const today = new Date().toISOString().split("T")[0];
    const nowTimestamp = Math.floor(Date.now() / 1000); 

    return (
        <div className="max-w-6xl mx-auto space-y-8 relative">
            
            {/* --- HEADER --- */}
            <div className="flex justify-between items-center">
                {isVerifier && <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold border border-green-200 shadow-sm animate-pulse">👋 Chào nhà trường! Bạn có nhiệm vụ xác nhận hồ sơ.</div>}
                {isAdmin && (
                    <button onClick={() => {setShowVerifierModal(true); fetchVerifierList();}} className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition">
                        🏫 Quản lý DS Trường ({verifierList.length || "?"})
                    </button>
                )}
            </div>

            {/* --- MODAL QUẢN LÝ TRƯỜNG --- */}
            {showVerifierModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up">
                        <div className="bg-gray-800 text-white p-6 flex justify-between items-center">
                            <h3 className="text-xl font-bold">🏫 Danh Sách Trường</h3>
                            <button onClick={() => setShowVerifierModal(false)} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full">✕</button>
                        </div>
                        <div className="p-6">
                            <div className="flex gap-3 mb-6">
                                <input className="flex-1 border border-gray-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Địa chỉ ví (0x...)" value={newVerifierInput} onChange={e => setNewVerifierInput(e.target.value)} />
                                <button onClick={handleAddVerifier} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow">+ Thêm</button>
                            </div>
                            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden max-h-[300px] overflow-y-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-100 text-gray-500 text-xs uppercase font-semibold">
                                        <tr><th className="p-4">STT</th><th className="p-4">Địa chỉ Ví</th><th className="p-4 text-right">Hành động</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {verifierList.map((addr, idx) => (
                                            <tr key={idx} className="hover:bg-white transition">
                                                <td className="p-4 font-mono text-gray-500">{idx + 1}</td>
                                                <td className="p-4 font-mono text-gray-800 break-all">{addr}</td>
                                                <td className="p-4 text-right"><button onClick={() => handleRemoveVerifier(addr)} className="text-red-500 hover:text-red-700 font-bold">Xóa 🗑️</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- FORM TẠO HỌC BỔNG --- */}
            {isAdmin && (
                <div className="p-8 bg-white rounded-2xl shadow-xl border border-indigo-50">
                    <h2 className="text-3xl font-bold mb-6 text-indigo-800 flex items-center gap-3"><span className="bg-indigo-100 p-2 rounded-lg text-2xl">🎓</span> Tạo Học Bổng Mới</h2>
                    <form onSubmit={handleCreateSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <input className="border p-3 rounded-lg" placeholder="Tên học bổng" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                            <input className="border p-3 rounded-lg" type="number" min="1" placeholder="Số lượng" value={form.slots} onChange={e => (e.target.value === '' || Number(e.target.value) >= 0) && setForm({...form, slots: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <input className="border p-3 rounded-lg" type="number" step="any" min="0" placeholder="Giá trị (WCT)" value={form.amount} onChange={e => (e.target.value === '' || Number(e.target.value) >= 0) && setForm({...form, amount: e.target.value})} />
                            <input className="border p-3 rounded-lg" type="date" min={today} value={form.deadlineDate} onChange={e => setForm({...form, deadlineDate: e.target.value})} />
                        </div>
                        <textarea className="w-full border p-3 rounded-lg" placeholder="Mô tả" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
                        <button disabled={isLoading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold shadow-md">
                            {isLoading ? statusText : "🚀 Tạo Học Bổng"}
                        </button>
                    </form>
                </div>
            )}

            {/* --- DANH SÁCH & TÌM KIẾM --- */}
            <div className="p-6 bg-white rounded-2xl shadow-lg border border-indigo-50">
                <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">📂 Quản Lý Hồ Sơ</h2>
                    <button onClick={handleManualRefresh} className="text-indigo-600 font-bold text-sm bg-indigo-50 px-3 py-1 rounded">{isRefreshing ? "Đang tải..." : "Làm mới"}</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[550px]">
                    
                    {/* CỘT TRÁI: LIST HỌC BỔNG */}
                    <div className="lg:col-span-1 border-r border-gray-100 pr-4 flex flex-col h-full">
                        <div className="mb-4 relative">
                            <input type="text" className="w-full border border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="Tìm tên/ID học bổng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            <span className="absolute left-3 top-2 text-gray-400">🔍</span>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3">
                            {filteredScholarships.map(s => {
                                const isExpired = nowTimestamp > s.deadline;
                                const hasFundsLeft = s.remainingSlots > 0;
                                const showWithdraw = isAdmin && s.creator === currentAccount && isExpired && hasFundsLeft;

                                return (
                                    <div key={s.id} onClick={() => handleSelectScholarship(s.id, s.totalApplicants)} 
                                        className={`p-4 rounded-xl cursor-pointer border transition hover:shadow-md relative
                                        ${selectedId === s.id ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white hover:border-indigo-300'}`}>
                                        
                                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{s.title}</h4>
                                        <div className="flex justify-between items-center mt-2 text-xs">
                                            <span className="text-gray-500">ID: #{s.id}</span>
                                            <span className={s.remainingSlots > 0 ? "text-green-600 font-bold" : "text-gray-400"}>
                                                Còn: {s.remainingSlots}/{s.originalSlots}
                                            </span>
                                        </div>
                                        {isExpired && <div className="mt-1 text-xs text-red-500 font-bold text-right">Đã hết hạn</div>}

                                        {showWithdraw && (
                                            <button onClick={(e) => handleWithdraw(e, s.id)} 
                                                className="mt-2 w-full bg-red-100 text-red-600 text-xs font-bold py-1.5 rounded hover:bg-red-200 shadow-sm animate-bounce">
                                                💰 Rút tiền thừa
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredScholarships.length === 0 && <p className="text-center text-gray-400 text-sm mt-4">Không tìm thấy.</p>}
                        </div>
                    </div>

                    {/* CỘT PHẢI: CHI TIẾT ỨNG VIÊN */}
                    <div className="lg:col-span-2 pl-2 flex flex-col h-full">
                        {selectedId !== null ? (
                            <>
                                {/* [MỚI] THANH TÌM KIẾM SINH VIÊN */}
                                <div className="mb-4 flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    <span className="text-gray-400 pl-2">🔍</span>
                                    <input 
                                        type="text" 
                                        className="bg-transparent w-full outline-none text-sm text-gray-700"
                                        placeholder="Tìm MSSV hoặc địa chỉ Ví..."
                                        value={applicantSearchTerm}
                                        onChange={(e) => setApplicantSearchTerm(e.target.value)}
                                    />
                                    {applicantSearchTerm && <button onClick={()=>setApplicantSearchTerm("")} className="text-gray-400 hover:text-black px-2">✕</button>}
                                </div>

                                {/* BẢNG DANH SÁCH */}
                                <div className="overflow-y-auto flex-1">
                                    {loadingList ? <p className="text-center mt-10 text-indigo-500">Đang tải...</p> : (
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                                                <tr>
                                                    <th className="p-3">MSSV / Ví</th>
                                                    <th className="p-3">Trạng thái</th>
                                                    <th className="p-3 text-right">Chi tiết</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredApplicants.map(app => {
                                                    const info = parseStudentInfo(app.metadata);
                                                    return (
                                                        <tr key={app.index} className="hover:bg-gray-50 border-b border-gray-100">
                                                            <td className="p-3">
                                                                <div className="font-bold text-gray-800">{info.id}</div>
                                                                <div className="font-mono text-xs text-gray-400 truncate w-32" title={app.applicant}>{app.applicant}</div>
                                                            </td>
                                                            <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold bg-${STATUS_COLOR[app.status]}-100 text-${STATUS_COLOR[app.status]}-700`}>{STATUS_MAP[app.status]}</span></td>
                                                            <td className="p-3 text-right"><button onClick={() => setViewingApp(app)} className="text-indigo-600 font-bold hover:underline">Xem</button></td>
                                                        </tr>
                                                    );
                                                })}
                                                {filteredApplicants.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-gray-400 italic">Không tìm thấy ứng viên nào.</td></tr>}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                👈 Chọn một học bổng để xem danh sách
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- MODAL CHI TIẾT --- */}
            {viewingApp && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-fade-in-up">
                        <div className="bg-gray-900 text-white p-5 flex justify-between items-center">
                            <h3 className="text-xl font-bold flex items-center gap-2">📄 Hồ sơ chi tiết <span className="text-sm bg-gray-700 px-2 py-0.5 rounded text-gray-300">#{viewingApp.index}</span></h3>
                            <button onClick={() => setViewingApp(null)} className="text-gray-400 hover:text-white transition bg-gray-800 hover:bg-gray-700 p-2 rounded-full">✕</button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className={`p-4 rounded-lg border flex items-center justify-between bg-${STATUS_COLOR[viewingApp.status]}-50 border-${STATUS_COLOR[viewingApp.status]}-200 text-${STATUS_COLOR[viewingApp.status]}-800`}>
                                <div><p className="text-xs uppercase font-bold opacity-70">Trạng thái</p><p className="font-bold text-lg">{STATUS_MAP[viewingApp.status]}</p></div>
                                <div className={`text-3xl`}>{viewingApp.status === 1 ? "⏳" : viewingApp.status === 2 ? "🏫" : viewingApp.status === 3 ? "✅" : viewingApp.status === 4 ? "💰" : "❌"}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500 uppercase font-bold">Mã Sinh Viên</p><p className="text-xl font-bold text-gray-800">{parseStudentInfo(viewingApp.metadata).id}</p></div>
                                <div className="p-4 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500 uppercase font-bold">Ngày nộp</p><p className="text-lg font-medium text-gray-700">{parseStudentInfo(viewingApp.metadata).time}</p></div>
                                <div className="col-span-2 p-4 bg-gray-50 rounded-lg border"><p className="text-xs text-gray-500 uppercase font-bold">Ví người nộp</p><p className="font-mono text-sm text-gray-600 break-all">{viewingApp.applicant}</p></div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <div className="bg-white p-2 rounded-lg text-2xl shadow-sm">📂</div>
                                <div className="flex-1"><p className="font-bold text-indigo-900">Tài liệu đính kèm</p><p className="text-xs text-indigo-500 truncate w-64">{viewingApp.metadata}</p></div>
                                <a href={getGatewayLink(viewingApp.metadata)} target="_blank" rel="noreferrer" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition">Mở File ↗</a>
                            </div>
                            <div className="pt-6 border-t border-gray-200">
                                {(isVerifier || isAdmin) && viewingApp.status === 1 && (
                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                                        <p className="text-sm text-yellow-800 font-bold mb-3">⚠️ Hành động dành cho Nhà Trường:</p>
                                        <div className="flex gap-3">
                                            <button onClick={() => handleVerify(viewingApp.index, false)} className="flex-1 bg-white border border-red-200 text-red-600 py-3 rounded-lg font-bold hover:bg-red-50 transition">❌ Từ chối hồ sơ</button>
                                            <button onClick={() => handleVerify(viewingApp.index, true)} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition">✅ Xác nhận hợp lệ</button>
                                        </div>
                                    </div>
                                )}
                                {isAdmin && viewingApp.status === 2 && (
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                        <p className="text-sm text-blue-800 font-bold mb-3">👑 Admin: Hồ sơ đã được trường xác nhận. Bạn có muốn duyệt?</p>
                                        <button onClick={() => handleApprove(viewingApp.index)} className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-orange-600 transition text-lg">✍️ Phê Duyệt Hồ Sơ</button>
                                    </div>
                                )}
                                {isAdmin && viewingApp.status === 3 && (
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-200 animate-pulse">
                                        <p className="text-sm text-green-800 font-bold mb-3">💰 Admin: Hồ sơ đã duyệt xong. Hãy chuyển tiền ngay!</p>
                                        <button onClick={() => handlePay(viewingApp.index)} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-green-700 transition text-lg">💸 Chuyển Tiền Ngay</button>
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