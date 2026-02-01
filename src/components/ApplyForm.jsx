import React, { useState } from "react";
import { getManagerContract } from "../services/eth";

const ApplyForm = ({ scholarshipId, onSuccess }) => {
  const [form, setForm] = useState({
    name: "",
    studentId: "",
    note: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.studentId) {
      return alert("Vui lòng nhập đầy đủ thông tin!");
    }

    try {
      setLoading(true);
      const manager = await getManagerContract();
      if (!manager) return alert("Chưa kết nối ví!");

      // ⚠️ Giả định smart contract có hàm applyScholarship
      const tx = await manager.applyScholarship(
        scholarshipId,
        form.name,
        form.studentId,
        form.note
      );

      await tx.wait();
      alert("✅ Nộp hồ sơ thành công!");
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Lỗi: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-6">
      <input
        className="w-full border p-3 rounded-lg"
        placeholder="Họ tên sinh viên"
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
      />

      <input
        className="w-full border p-3 rounded-lg"
        placeholder="Mã số sinh viên"
        value={form.studentId}
        onChange={e => setForm({ ...form, studentId: e.target.value })}
      />

      <textarea
        className="w-full border p-3 rounded-lg h-24"
        placeholder="Hoàn cảnh / ghi chú (tuỳ chọn)"
        value={form.note}
        onChange={e => setForm({ ...form, note: e.target.value })}
      />

      <button
        disabled={loading}
        className={`w-full py-3 rounded-xl font-bold text-white transition ${
          loading
            ? "bg-gray-400"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
      >
        {loading ? "Đang gửi hồ sơ..." : "Nộp hồ sơ"}
      </button>
    </form>
  );
};

export default ApplyForm;
