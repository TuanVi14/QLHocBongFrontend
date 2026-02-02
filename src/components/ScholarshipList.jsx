import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getManagerContract, getTokenContract } from '../services/eth';
import { ethers } from 'ethers';
import ScholarshipDetailModal from './ScholarshipDetailModal'; // Đảm bảo bạn có file này

const ScholarshipList = ({ refreshTrigger }) => {
    const [list, setList] = useState([]);
    const [selectedScholarship, setSelectedScholarship] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // [MỚI] State cho tìm kiếm
    const [searchTerm, setSearchTerm] = useState("");

    // ==========================================
    // 1. TẢI DỮ LIỆU
    // ==========================================
    const fetchScholarships = useCallback(async () => {
        try {
            const manager = await getManagerContract();
            const token = await getTokenContract();
            if (!manager || !token) return;

            const count = await manager.nextScholarshipId();
            const decimals = await token.decimals();
            const symbol = await token.symbol();

            const items = [];
            for (let i = Number(count) - 1; i >= 0; i--) {
                const s = await manager.scholarships(i);
                
                const totalSlots = Number(s.slots);
                const filledSlots = Number(s.filledSlots);
                const remaining = Math.max(0, totalSlots - filledSlots);
                const deadlineDate = new Date(Number(s.deadline) * 1000);
                const isExpired = Date.now() > deadlineDate.getTime();

                items.push({
                    id: Number(s.id),
                    title: s.title,
                    description: s.description || "Chưa có mô tả chi tiết.",
                    amount: ethers.formatUnits(s.amount, decimals),
                    symbol: symbol,
                    originalSlots: totalSlots,
                    remainingSlots: remaining,
                    deadline: deadlineDate.toLocaleDateString('vi-VN'),
                    isExpired: isExpired,
                    // Giữ lại timestamp để so sánh nếu cần
                    timestamp: Number(s.deadline) * 1000
                });
            }
            setList(items);
        } catch (e) {
            console.error("Lỗi tải danh sách:", e);
        }
    }, []);

    useEffect(() => {
        fetchScholarships();
    }, [refreshTrigger, fetchScholarships]);

    // ==========================================
    // 2. LOGIC TÌM KIẾM (FILTER)
    // ==========================================
    const filteredList = useMemo(() => {
        if (!searchTerm) return list;
        const lowerTerm = searchTerm.toLowerCase();
        return list.filter(item => 
            item.title.toLowerCase().includes(lowerTerm)
        );
    }, [list, searchTerm]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        setList([]); 
        await new Promise(r => setTimeout(r, 500));
        await fetchScholarships();
        setIsRefreshing(false);
    };

    // ==========================================
    // 3. XỬ LÝ NỘP HỒ SƠ (TỪ MODAL GỬI VỀ)
    // ==========================================
    const handleApplySubmit = async (scholarshipId, formData) => {
        setLoading(true);
        try {
            // Kiểm tra lại suất (Client check)
            const target = list.find(item => item.id === scholarshipId);
            if (target && target.remainingSlots <= 0) {
                alert("Rất tiếc, học bổng này vừa hết suất!");
                setLoading(false);
                return;
            }

            console.log("Đang nộp hồ sơ ID:", scholarshipId, formData);
            
            // Xử lý link: Nếu Modal trả về link thì dùng, không thì tạo hash giả (như code cũ của bạn)
            const linkToSubmit = formData.link || `ipfs://QmHoso_${formData.studentId}_${Date.now()}`;

            const manager = await getManagerContract();
            if (!manager) throw new Error("Chưa kết nối ví MetaMask");

            // Gọi Smart Contract
            const tx = await manager.applyForScholarship(scholarshipId, linkToSubmit);
            await tx.wait(); 

            alert(`✅ Nộp hồ sơ thành công!\nThông tin đã được gửi lên Blockchain.`);
            
            setSelectedScholarship(null); // Đóng Modal
            handleManualRefresh();        // Load lại danh sách

        } catch(e) {
            console.error(e);
            alert("Lỗi: " + (e.reason || e.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-6">
            
            {/* --- HEADER + TÌM KIẾM --- */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b pb-6">
                <h1 className="text-3xl font-bold text-gray-800 uppercase tracking-wide">
                    Danh Sách Học Bổng
                </h1>
                
                <div className="flex gap-3 w-full md:w-auto">
                    {/* INPUT TÌM KIẾM */}
                    <div className="relative flex-1 md:w-80">
                        <input 
                            type="text"
                            className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition"
                            placeholder="Tìm kiếm theo tên..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                    </div>

                    <button 
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className={`px-4 py-2 rounded-full font-bold shadow-sm transition-all whitespace-nowrap flex items-center gap-2
                            ${isRefreshing ? 'bg-gray-100 text-gray-400' : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'}`}
                    >
                        <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        {isRefreshing ? "Đang tải..." : "Làm mới"}
                    </button>
                </div>
            </div>
            
            {/* --- DANH SÁCH (GRID) --- */}
            {list.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">{isRefreshing ? "Đang đồng bộ dữ liệu..." : "Chưa có học bổng nào."}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredList.map(item => {
                    const isFull = item.remainingSlots <= 0;
                    const isDisabled = item.isExpired || isFull;

                    return (
                        <div key={item.id} className={`bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-1 transition duration-300 flex flex-col h-full ${isDisabled ? 'opacity-80 grayscale-[0.2]' : ''}`}>
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2 min-h-[3.5rem]" title={item.title}>
                                    {item.title}
                                </h3>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-gray-500 text-xs font-semibold uppercase">Giá trị</p>
                                        <span className="text-2xl font-bold text-indigo-600">
                                            {Number(item.amount).toLocaleString()} <span className="text-sm text-gray-500">{item.symbol}</span>
                                        </span>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap 
                                        ${item.remainingSlots > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-600'}`}>
                                        {item.remainingSlots > 0 ? `Còn ${item.remainingSlots}/${item.originalSlots} suất` : 'HẾT SUẤT'}
                                    </span>
                                </div>
                                
                                <p className="text-gray-500 text-sm mt-3 line-clamp-3 h-[3.8rem]">
                                    {item.description}
                                </p>
                            </div>
                            
                            <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-xs text-gray-400 font-medium">Hạn: {item.deadline}</span>
                                
                                {isDisabled ? (
                                    <button disabled className="bg-gray-200 text-gray-500 px-4 py-2 rounded-lg text-sm font-bold cursor-not-allowed">
                                        {item.isExpired ? "Đã Hết Hạn" : "Đã Hết Suất"}
                                    </button>
                                ) : (
                                    // Bấm nút này sẽ mở Modal
                                    <button 
                                        onClick={() => setSelectedScholarship(item)}
                                        className="text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-bold transition shadow-md flex items-center gap-1"
                                    >
                                        Xem & Ứng tuyển →
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                
                {filteredList.length === 0 && list.length > 0 && (
                    <div className="col-span-3 text-center py-10 text-gray-500">
                        Không tìm thấy học bổng nào với từ khóa "{searchTerm}".
                    </div>
                )}
            </div>

            {/* --- MODAL (DÙNG LẠI COMPONENT BẠN YÊU CẦU) --- */}
            {selectedScholarship && (
                <ScholarshipDetailModal 
                    scholarship={selectedScholarship}
                    onClose={() => setSelectedScholarship(null)}
                    onApplySubmit={handleApplySubmit}
                    loading={loading}
                />
            )}
        </div>
    );
};

export default ScholarshipList;