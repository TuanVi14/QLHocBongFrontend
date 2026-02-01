import React, { useState } from 'react';

const ScholarshipDetailModal = ({ scholarship, onClose, onApplySubmit, loading }) => {
    // State quản lý hiển thị: 'details' (xem) hoặc 'form' (điền)
    const [viewMode, setViewMode] = useState('details'); 

    // State lưu dữ liệu form
    const [formData, setFormData] = useState({
        fullName: '',
        studentId: '',
        email: '',
        reason: '',
        file: null // Lưu file object
    });

    if (!scholarship) return null;
    const isExpired = Date.now() > scholarship.timestamp;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, file: e.target.files[0] }));
        }
    };

    const handleSubmit = () => {
        if (!formData.fullName || !formData.studentId || !formData.file) {
            alert("Vui lòng điền đầy đủ thông tin và tải hồ sơ minh chứng!");
            return;
        }
        onApplySubmit(scholarship.id, formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            {/* Click backdrop to close */}
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden z-10 flex flex-col max-h-[90vh]">
                
                {/* --- HEADER --- */}
                <div className="bg-indigo-600 p-6 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold truncate pr-4">
                            {viewMode === 'details' ? scholarship.title : 'Nộp Hồ Sơ Ứng Tuyển'}
                        </h2>
                        {viewMode === 'form' && <p className="text-indigo-200 text-sm">Đang nộp cho ID: #{scholarship.id}</p>}
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white text-3xl leading-none">&times;</button>
                </div>

                {/* --- BODY (Cuộn được) --- */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    
                    {/* MODE 1: XEM CHI TIẾT */}
                    {viewMode === 'details' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <p className="text-xs text-green-600 font-bold uppercase">Giá trị</p>
                                    <p className="text-lg font-bold text-gray-800">{scholarship.amount} {scholarship.symbol}</p>
                                </div>
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <p className="text-xs text-blue-600 font-bold uppercase">Còn lại</p>
                                    <p className="text-lg font-bold text-gray-800">{scholarship.slots} suất</p>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-2">Mô tả chi tiết</h4>
                                <div className="text-gray-600 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100 leading-relaxed">
                                    {scholarship.description}
                                </div>
                            </div>
                            <div className="text-sm text-gray-500 pt-2 border-t">
                                Hạn nộp hồ sơ: <span className="font-medium text-gray-800">{scholarship.deadline}</span>
                                {isExpired && <span className="ml-2 text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded text-xs">ĐÃ HẾT HẠN</span>}
                            </div>
                        </div>
                    )}

                    {/* MODE 2: FORM ĐIỀN THÔNG TIN & UPLOAD */}
                    {viewMode === 'form' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                                <input name="fullName" value={formData.fullName} onChange={handleChange} 
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 ring-indigo-200 focus:outline-none" placeholder="VD: Nguyễn Văn A" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã sinh viên</label>
                                    <input name="studentId" value={formData.studentId} onChange={handleChange}
                                        className="w-full border rounded-lg p-2.5 focus:ring-2 ring-indigo-200 focus:outline-none" placeholder="VD: B2001234" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input name="email" value={formData.email} onChange={handleChange}
                                        className="w-full border rounded-lg p-2.5 focus:ring-2 ring-indigo-200 focus:outline-none" placeholder="email@example.com" />
                                </div>
                            </div>
                            
                            {/* Khu vực Upload File */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hồ sơ minh chứng (PDF/ZIP)</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer relative group">
                                    <input 
                                        type="file" 
                                        onChange={handleFileChange} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept=".pdf,.doc,.docx,.zip,.png,.jpg"
                                    />
                                    <div className="flex flex-col items-center">
                                        <svg className="w-10 h-10 text-gray-400 group-hover:text-indigo-500 mb-2 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                        {formData.file ? (
                                            <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{formData.file.name}</span>
                                        ) : (
                                            <span className="text-sm text-gray-500">Kéo thả hoặc bấm để chọn file</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do xin học bổng</label>
                                <textarea name="reason" value={formData.reason} onChange={handleChange} rows="3"
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 ring-indigo-200 focus:outline-none" placeholder="Trình bày ngắn gọn hoàn cảnh..." />
                            </div>
                        </div>
                    )}
                </div>

                {/* --- FOOTER (Nút bấm) --- */}
                <div className="p-6 border-t bg-gray-50 flex justify-between items-center shrink-0">
                    {viewMode === 'form' ? (
                        <button onClick={() => setViewMode('details')} className="text-gray-500 hover:text-gray-700 font-medium text-sm flex items-center gap-1">
                            ← Quay lại
                        </button>
                    ) : (
                        <span></span> 
                    )}

                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-200 transition">
                            Đóng
                        </button>

                        {viewMode === 'details' ? (
                            <button 
                                onClick={() => setViewMode('form')}
                                disabled={isExpired}
                                className={`px-5 py-2.5 rounded-lg text-white font-medium shadow-lg transition transform hover:-translate-y-0.5
                                    ${isExpired ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700'}
                                `}
                            >
                                {isExpired ? 'Đã hết hạn' : 'Tiến hành nộp hồ sơ'}
                            </button>
                        ) : (
                            <button 
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-5 py-2.5 rounded-lg text-white font-medium shadow-lg bg-green-600 hover:bg-green-700 flex items-center gap-2 transform hover:-translate-y-0.5 transition"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Đang xử lý...
                                    </>
                                ) : 'Xác nhận nộp'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScholarshipDetailModal;