import React, { useState, useEffect } from 'react';
import ScholarshipList from './components/ScholarshipList';
import AdminDashboard from './components/AdminDashboard';
import { connectWallet, getTokenBalance } from './services/eth';

function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState({ val: "0", symbol: "" }); 
  
  // [MỚI] State dùng để kích hoạt làm mới danh sách học bổng
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleConnect = async () => {
    const acc = await connectWallet(true);
    if (acc) {
      setAccount(acc);
      await updateBalance(acc);
    }
  };

  const handleDisconnect = () => {
    setAccount(null);
    setBalance({ val: "0", symbol: "" });
  };

  const updateBalance = async (acc) => {
    if (!acc) return;
    const bal = await getTokenBalance(acc);
    setBalance(bal);
  };

  // [MỚI] Hàm xử lý làm mới toàn bộ (Số dư + Danh sách)
  // Hàm này sẽ được truyền xuống cho AdminDashboard gọi
  const handleGlobalRefresh = async () => {
    console.log("🔄 Đang làm mới toàn bộ hệ thống...");
    
    // 1. Cập nhật lại số dư (nếu đang kết nối)
    if (account) {
        await updateBalance(account);
    }

    // 2. Kích hoạt tải lại danh sách học bổng bên dưới
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          updateBalance(accounts[0]);
        } else {
          handleDisconnect();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
    
    // Tự động kết nối lại nếu F5 (giữ session)
    connectWallet(false).then(acc => { 
        if(acc) { 
            setAccount(acc); 
            updateBalance(acc); 
        } 
    });

  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <nav className="flex justify-between items-center px-6 py-4 bg-white shadow-sm sticky top-0 z-50">
        <h1 className="text-2xl font-extrabold text-indigo-700 tracking-tight flex items-center gap-2">
            🎓 ScholarChain <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">WCT Edition</span>
        </h1>

        {!account ? (
          <button
            onClick={handleConnect}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Kết nối / Chọn Ví
          </button>
        ) : (
          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Số dư khả dụng</p>
                <p className="text-indigo-600 font-bold font-mono text-lg">
                    {Number(balance.val).toLocaleString()} {balance.symbol}
                </p>
             </div>

             <div className="flex items-center bg-gray-100 rounded-full pl-4 pr-2 py-1 border border-gray-200 gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-gray-700">
                        {account.slice(0,6)}...{account.slice(-4)}
                    </span>
                </div>
                
                <button 
                    onClick={handleConnect} 
                    title="Đổi ví"
                    className="bg-white p-1.5 rounded-full text-blue-500 hover:bg-blue-50 transition shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                </button>

                <button 
                    onClick={handleDisconnect}
                    title="Ngắt kết nối"
                    className="bg-white p-1.5 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-50 transition shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
             </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        {account && (
            <section>
                {/* [QUAN TRỌNG] Truyền hàm refresh xuống AdminDashboard */}
                <AdminDashboard refreshBalance={handleGlobalRefresh} />
            </section>
        )}
        <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center">
                <span className="px-3 bg-gray-50 text-lg font-medium text-gray-900">Danh sách học bổng đang mở</span>
            </div>
        </div>
        <section>
            {/* [QUAN TRỌNG] Truyền trigger xuống để List tự reload */}
            <ScholarshipList refreshTrigger={refreshTrigger} />
        </section>
      </main>
    </div>
  );
}

export default App;