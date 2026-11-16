// 大字顯示房間碼與學生加入網址（TECH_SPEC §10.4）
export default function RoomCode({ roomCode }: { roomCode: string }) {
  const url = `${window.location.origin}/join?room=${roomCode}`;
  return (
    <div className="room-code">
      <div>房間碼</div>
      <div data-testid="room-code" className="room-code-value">{roomCode}</div>
      <div className="room-code-url">加入網址：{url}</div>
    </div>
  );
}
