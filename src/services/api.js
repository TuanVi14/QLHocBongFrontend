import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

// Hàm lấy danh sách học bổng từ Database
export const fetchScholarshipsDB = async () => {
    try {
        const res = await axios.get(`${API_URL}/scholarships`);
        return res.data;
    } catch (error) {
        console.error("API Error:", error);
        return [];
    }
};

// Hàm lưu học bổng mới vào Database
export const createScholarshipDB = async (data) => {
    try {
        const res = await axios.post(`${API_URL}/scholarships`, data);
        return res.data;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
};

// Các hàm giữ chỗ (nếu cần mở rộng sau này)
export const applyScholarship = async () => {};
export const getApplications = async () => {};
export const login = async () => {};
export const register = async () => {};