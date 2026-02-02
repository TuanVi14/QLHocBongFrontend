import { ethers, formatUnits } from 'ethers';
import ScholarshipArtifact from '../contracts/ScholarshipManager.json'; 

export const MANAGER_ADDRESS = "0xD734547a85a695F76E3B34c8cc38A951474DAC59";
export const TOKEN_ADDRESS = "0x6A83d94381AAAF4e14Fc8d3414463E1cF0A53d61";

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) public returns (bool)"
];

export const getEthereumObject = () => window.ethereum;

// --- CẬP NHẬT: HÀM KẾT NỐI CHO PHÉP CHỌN VÍ CHÍNH XÁC ---
export const connectWallet = async (forceSwitch = false) => {
    if (!getEthereumObject()) return alert("Vui lòng cài đặt MetaMask!");
    
    const provider = new ethers.BrowserProvider(window.ethereum);

    try {
        // 1. KÍCH HOẠT POPUP CHỌN VÍ (Nếu forceSwitch = true)
        if (forceSwitch) {
            await window.ethereum.request({
                method: "wallet_requestPermissions",
                params: [{ eth_accounts: {} }], 
            });
        }

        // 2. TỰ ĐỘNG CHUYỂN MẠNG CRONOS TESTNET
        const network = await provider.getNetwork();
        if (network.chainId !== 338n) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x152' }], // Hex của 338
                });
            } catch (switchError) {
                // Nếu chưa có mạng thì thêm vào
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x152',
                            chainName: 'Cronos Testnet',
                            rpcUrls: ['https://evm-t3.cronos.org'],
                            nativeCurrency: { name: 'TCRO', symbol: 'TCRO', decimals: 18 },
                            blockExplorerUrls: ['https://testnet.cronoscan.com']
                        }],
                    });
                } else {
                    alert("Vui lòng chuyển mạng sang Cronos Testnet!");
                    return null;
                }
            }
        }

        // 3. LẤY DANH SÁCH VÍ (SỬ DỤNG LỆNH GỐC ĐỂ CHUẨN XÁC HƠN)
        // Lưu ý: Lệnh này sẽ trả về danh sách ví người dùng đã Tick chọn.
        // Ví đầu tiên [0] luôn là ví 'Active' trên giao diện MetaMask.
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        
        return accounts[0];

    } catch (error) {
        if (error.code === 4001) {
            console.log("Người dùng đã hủy chọn ví.");
        } else {
            console.error("Lỗi kết nối:", error);
        }
        return null;
    }
};

// ... CÁC HÀM CONTRACT GIỮ NGUYÊN ...
export const getManagerContract = async () => {
    if (!getEthereumObject()) return null;
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(); 
        return new ethers.Contract(MANAGER_ADDRESS, ScholarshipArtifact.abi, signer);
    } catch (error) { console.error(error); return null; }
};

export const getTokenContract = async () => {
    if (!getEthereumObject()) return null;
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
    } catch (error) { console.error(error); return null; }
}

export const getTokenBalance = async (address) => {
    if (!getEthereumObject()) return { val: "0", symbol: "" };
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
        const bal = await contract.balanceOf(address);
        const dec = await contract.decimals();
        const sym = await contract.symbol();
        return { val: formatUnits(bal, dec), symbol: sym };
    } catch (error) { return { val: "0", symbol: "" }; }
};