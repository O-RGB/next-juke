// แปลงวินาทีเป็น MM:SS
function formatTime(s) {
  if (!s) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

// ดึง Video ID จากลิงก์ YouTube
function extractVideoID(url) {
  const m = url.match(
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
  );
  return m && m[7].length == 11 ? m[7] : false;
}

// เรียกข้อมูลวิดีโอจาก NoEmbed API
async function fetchVideoInfo(url) {
  try {
    const response = await fetch(`https://noembed.com/embed?url=${url}`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching video info:", error);
    return {};
  }
}
