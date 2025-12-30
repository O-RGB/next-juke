// ตั้งค่า PeerJS Server (ใช้ของ Google STUN)
const PEER_CONFIG = {
  config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
};

// ค่าคงที่อื่นๆ
const APP_NAME = "NextJuke";
