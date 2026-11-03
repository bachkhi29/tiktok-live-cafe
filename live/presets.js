export const SCENES = [
  { id: 'cafe', name: 'Cà phê sau 12h', icon: '☕', note: 'Gỗ ấm · ánh hổ phách', wall: '#392b30', floor: '#61463d', accent: '#efbc95', motif: 'cafe' },
  { id: 'concert', name: 'Neon concert', icon: '♫', note: 'Sân khấu · ánh tím', wall: '#30213e', floor: '#4d3759', accent: '#caafff', motif: 'neon' },
  { id: 'garden', name: 'Vườn ánh trăng', icon: '♧', note: 'Lá xanh · đom đóm', wall: '#243a33', floor: '#385640', accent: '#b5d3a4', motif: 'garden' },
  { id: 'rooftop', name: 'Rooftop thành phố', icon: '☾', note: 'Mái kính · đường chân trời', wall: '#202e45', floor: '#3e4d62', accent: '#a6c9e6', motif: 'rooftop' },
  { id: 'library', name: 'Tiệm sách đêm', icon: '▤', note: 'Kệ sách · đèn bàn', wall: '#3c302c', floor: '#63503d', accent: '#dcc39b', motif: 'books' },
  { id: 'beach', name: 'Cà phê bên biển', icon: '≈', note: 'Sóng nhẹ · cát mịn', wall: '#25424b', floor: '#7b6851', accent: '#b5ddd6', motif: 'sea' },
  { id: 'rain', name: 'Góc mưa Sài Gòn', icon: '☂', note: 'Cửa kính · mưa đêm', wall: '#293444', floor: '#4b4d5a', accent: '#aec2dc', motif: 'rain' },
  { id: 'arcade', name: 'Pixel arcade', icon: '◇', note: 'Máy game · neon hồng', wall: '#30213d', floor: '#513354', accent: '#edabdc', motif: 'arcade' },
  { id: 'sakura', name: 'Hiên hoa anh đào', icon: '✿', note: 'Cánh hoa · đèn giấy', wall: '#49323e', floor: '#71515a', accent: '#f2c1d0', motif: 'sakura' },
  { id: 'cabin', name: 'Nhà gỗ mùa đông', icon: '❄', note: 'Lò sưởi · tuyết rơi', wall: '#342f35', floor: '#665047', accent: '#e8c8a0', motif: 'snow' },
];
export const AMBIENTS = [
  { id: 'lofi', name: 'Midnight lofi', bpm: 72, wave: 'sine', notes: [130.81, 110, 87.31, 98], melody: [0, 7, 12, 4, 7, 2, 11, 7] },
  { id: 'piano', name: 'Piano bên cửa sổ', bpm: 60, wave: 'triangle', notes: [146.83, 130.81, 110, 98], melody: [12, 7, 4, 2, 0, 4, 7, 11] },
  { id: 'bossa', name: 'Bossa cà phê', bpm: 90, wave: 'sine', notes: [130.81, 146.83, 98, 110], melody: [7, 9, 7, 4, 2, 4, 7, 12] },
  { id: 'dream', name: 'Vườn mơ', bpm: 50, wave: 'sine', notes: [110, 130.81, 164.81, 146.83], melody: [12, 19, 16, 14, 7, 12, 16, 19] },
  { id: 'rain', name: 'Mưa và hợp âm', bpm: 66, wave: 'sine', notes: [123.47, 98, 110, 82.41], melody: [0, 7, 2, 9, 7, 4, 2, 0], rain: true },
  { id: 'nightdrive', name: 'Night drive', bpm: 84, wave: 'triangle', notes: [110, 87.31, 130.81, 98], melody: [0, 12, 7, 14, 12, 7, 4, 7] },
];
// Offline rehearsal samples, not a current TikTok price list. Real gifts use event metadata.
export const DEMO_GIFTS = [
  { name: 'Rose · Hoa hồng', coins: 1, icon: '🌹' }, { name: 'Finger Heart · Tim ngón tay', coins: 5, icon: '🫰' },
  { name: 'Perfume · Nước hoa', coins: 20, icon: '🧴' }, { name: 'Doughnut · Bánh donut', coins: 30, icon: '🍩' },
  { name: 'Paper Crane · Hạc giấy', coins: 99, icon: '🕊' }, { name: 'Hand Hearts · Tay trái tim', coins: 100, icon: '🫶' },
  { name: 'Sunglasses · Kính râm', coins: 199, icon: '😎' }, { name: 'Confetti · Pháo giấy', coins: 100, icon: '🎉' },
  { name: 'Galaxy · Dải ngân hà', coins: 1000, icon: '🌌' }, { name: 'Lion · Sư tử', coins: 29999, icon: '🦁' },
];
export const DEFAULT_LINES = [
  { id: 'welcome', label: 'Chào khách', text: 'Tôi chào mừng mọi người đến với Cà Phê Sau 12 giờ. Mọi người vào quán là có chỗ ngồi, cứ bình luận để cùng trò chuyện nhé.' },
  { id: 'order', label: 'Nhắc order nhạc', text: 'Tôi mời mọi người xem mã bài ở phía trên rồi bình luận chấm than nhạc kèm mã bài. Cách xếp hàng đang được hiển thị trên màn hình nhé.' },
  { id: 'thanks', label: 'Cảm ơn cả quán', text: 'Tôi cảm ơn mọi người đã cùng ngồi lại. Chúc mọi người một buổi tối thật nhẹ nhàng.' },
  { id: 'stage', label: 'Mời lên sân khấu', text: 'Sân khấu đã sẵn sàng. Tôi mời mọi người cùng lên nhịp và khuấy động quán nhé.' },
];
export const DEFAULT_REACTIONS = {
  rose: ['Mình cảm ơn bạn {name} đã tặng {count} hoa hồng nhé. Mời bạn lên sân khấu cùng mình nào.', 'Cảm ơn bạn {name} vì {count} hoa hồng. Mình đã nhận được món quà của bạn rồi nhé.', 'Mình gửi một lời cảm ơn đến bạn {name} vì {count} hoa hồng. Chúc bạn nghe nhạc thật vui nhé.'],
  gift: ['Mình cảm ơn bạn {name} đã tặng {gift}, số lượng {count}. Chúc bạn một buổi tối thật dễ chịu nhé.', 'Cảm ơn bạn {name} đã gửi {gift} đến quán. Mình chúc bạn có những phút giây thật vui nhé.'],
  follow: ['Cảm ơn bạn {name} đã follow kênh của mình nhé.'],
};
