import React, { useEffect, useState, useCallback } from 'react';
import { getManagerContract, getTokenContract } from '../services/eth';
import { ethers } from 'ethers';
import ScholarshipDetailModal from './ScholarshipDetailModal';

const ScholarshipList = ({ refreshTrigger }) => {
    const [list, setList] = useState([]);
    const [selectedScholarship, setSelectedScholarship] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // ==========================================
    // 1. TẢI DỮ LIỆU (ĐÃ CẬP NHẬT STRUCT MỚI)
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
            // Lấy từ mới nhất về cũ nhất
            for (let i = Number(count) - 1; i >= 0; i--) {
                const s = await manager.scholarships(i);
                
                // --- XỬ LÝ DỮ LIỆU TỪ CONTRACT MỚI ---
                // Struct: {id, title, amount, slots, filledSlots, deadline, description, totalApplicants}
                
                const totalSlots = Number(s.slots);
                const filledSlots = Number(s.filledSlots);
                const remaining = Math.max(0, totalSlots - filledSlots);

                items.push({
                    id: Number(s.id),
                    title: s.title,
                    
                    // [CẬP NHẬT] Lấy mô tả từ Contract (s.description hoặc index 6)
                    description: s.description || s[6] || "Chưa có mô tả chi tiết.",
                    
                    amount: ethers.formatUnits(s.amount, decimals),
                    symbol: symbol,
                    
                    // [CẬP NHẬT] Số suất
                    originalSlots: totalSlots,
                    remainingSlots: remaining,
                    
                    deadline: new Date(Number(s.deadline) * 1000).toLocaleDateString('vi-VN'),
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
    // 2. XỬ LÝ LÀM MỚI
    // ==========================================
    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        setList([]); 
        await new Promise(r => setTimeout(r, 500));
        await fetchScholarships();
        setIsRefreshing(false);
    };

    // ==========================================
    // 3. NỘP HỒ SƠ
    // ==========================================
    const handleApplySubmit = async (scholarshipId, formData) => {
        setLoading(true);
        try {
            // Kiểm tra xem còn suất không trước khi cho nộp (Client side check)
            const target = list.find(item => item.id === scholarshipId);
            if (target && target.remainingSlots <= 0) {
                alert("Rất tiếc, học bổng này đã hết suất!");
                setLoading(false);
                return;
            }

            console.log("Đang xử lý nộp hồ sơ cho ID:", scholarshipId);
            await new Promise(r => setTimeout(r, 1000)); // Fake upload delay
            
            const fileHashMock = `ipfs://QmHoso_${formData.studentId}_${Date.now()}`;
             
            const manager = await getManagerContract();
            if (!manager) throw new Error("Chưa kết nối ví MetaMask");

            const tx = await manager.applyForScholarship(scholarshipId, fileHashMock);
            await tx.wait(); 

            alert(`✅ Nộp hồ sơ thành công!\nMã hồ sơ: ${fileHashMock}`);
            setSelectedScholarship(null); 
            handleManualRefresh(); // Load lại để cập nhật số lượng (nếu cần)

        } catch(e) {
            console.error(e);
            alert("Lỗi: " + (e.reason || e.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b pb-4 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 uppercase tracking-wide">
                    Danh Sách Học Bổng
                </h1>
                
                <button 
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold shadow-sm transition-all
                        ${isRefreshing 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400'
                        }`}
                >
                    <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    {isRefreshing ? "Đang cập nhật..." : "Làm mới"}
                </button>
            </div>
            
            {list.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    {isRefreshing ? (
                        <p className="text-indigo-500 font-medium animate-pulse">Đang đồng bộ dữ liệu từ Blockchain...</p>
                    ) : (
                        <p className="text-gray-500">Đang tải hoặc chưa có học bổng nào.</p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {list.map(item => (
                    <div key={item.id} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:-translate-y-1 transition duration-300 flex flex-col h-full">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2 min-h-[3.5rem]" title={item.title}>
                                {item.title}
                            </h3>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-gray-500 text-xs font-semibold uppercase">Giá trị</p>
                                    <span className="text-2xl font-bold text-green-600">
                                        {Number(item.amount).toLocaleString()} <span className="text-sm text-gray-500">{item.symbol}</span>
                                    </span>
                                </div>
                                {/* HIỂN THỊ SỐ SUẤT CÒN LẠI */}
                                <span className={`px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap 
                                    ${item.remainingSlots > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-600'}`}>
                                    {item.remainingSlots > 0 ? `Còn ${item.remainingSlots}/${item.originalSlots} suất` : 'HẾT SUẤT'}
                                </span>
                            </div>
                            
                            {/* Hiển thị mô tả ngắn */}
                            <p className="text-gray-500 text-sm mt-3 line-clamp-3 h-[3.8rem]">
                                {item.description}
                            </p>
                        </div>
                        
                        <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                            <span className="text-xs text-gray-400 font-medium">Hạn: {item.deadline}</span>
                            
                            {item.remainingSlots > 0 ? (
                                <button 
                                    onClick={() => setSelectedScholarship(item)}
                                    className="text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition shadow-md hover:shadow-lg flex items-center gap-1"
                                >
                                    Xem & Ứng tuyển →
                                </button>
                            ) : (
                                <button disabled className="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                                    Đã hết hạn/suất
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

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