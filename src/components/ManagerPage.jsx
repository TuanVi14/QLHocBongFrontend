import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard'; // File này giờ đã chứa cả Tạo và Duyệt
import ScholarshipList from './components/ScholarshipList';
import { connectWallet } from './services/eth';

// ĐỊNH NGHĨA VÍ ADMIN (Hãy chắc chắn ví MetaMask của bạn khớp 100% với địa chỉ này)
const ADMIN_ADDRESS = "0x21143185aBb050330F6Da0B5c3f1089A0ab6De93";

const ManagerPage = () => {
    const [refreshSignal, setRefreshSignal] = useState(0);
    const [currentAccount, setCurrentAccount] = useState("");

    // Kiểm tra ví khi load trang
    useEffect(() => {
        const checkWallet = async () => {
            const account = await connectWallet();
            if (account) {
                setCurrentAccount(account);
            }
        };
        checkWallet();

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                setCurrentAccount(accounts[0] || "");
                // Reload trang khi đổi ví để cập nhật giao diện ngay lập tức
                window.location.reload();
            });
        }
    }, []);

    const handleRefreshList = () => {
        setRefreshSignal(prev => prev + 1);
    };

    // Kiểm tra Admin (Không phân biệt chữ hoa/thường)
    const isAdmin = currentAccount && currentAccount.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
            <div className="max-w-6xl mx-auto space-y-12">
                
                {/* HIỂN THỊ TRẠNG THÁI VÍ */}
                <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                    <h1 className="text-2xl font-bold text-indigo-700">Hệ Thống Học Bổng Blockchain</h1>
                    <div className="text-right">
                        {currentAccount ? (
                            <div>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold border ${isAdmin ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                                    {isAdmin ? "👑 ADMIN ACCESS" : "👤 SINH VIÊN"}
                                </span>
                                <p className="text-xs text-gray-500 mt-1 font-mono">{currentAccount}</p>
                            </div>
                        ) : (
                            <button onClick={() => connectWallet(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">
                                Kết Nối Ví
                            </button>
                        )}
                    </div>
                </div>

                {/* LOGIC PHÂN QUYỀN */}
                {isAdmin ? (
                    <>
                        {/* 1. GIAO DIỆN ADMIN (Bao gồm cả Tạo và Duyệt) */}
                        <AdminDashboard />

                        {/* 2. GIAO DIỆN XEM TRƯỚC CỦA SINH VIÊN */}
                        <div className="border-t-4 border-dashed border-gray-200 pt-8 mt-12">
                            <h3 className="text-xl font-bold text-gray-400 mb-6 text-center uppercase tracking-widest">
                                --- Giao diện hiển thị cho Sinh Viên ---
                            </h3>
                            <ScholarshipList refreshTrigger={refreshSignal} />
                        </div>
                    </>
                ) : (
                    <>
                        {/* GIAO DIỆN SINH VIÊN (Nếu không phải Admin) */}
                        {currentAccount ? (
                            <ScholarshipList refreshTrigger={refreshSignal} />
                        ) : (
                            <div className="text-center py-20">
                                <h3 className="text-xl text-gray-500">Vui lòng kết nối ví để xem danh sách học bổng.</h3>
                            </div>
                        )}
                    </>
                )}
                
            </div>
        </div>
    );
};

export default ManagerPage;