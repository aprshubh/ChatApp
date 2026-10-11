export const initialConversations = [
  {
    id: 'conv_1',
    user: {
      id: 'u1',
      name: 'Elena Rostova',
      username: '@elena_r',
      email: 'elena@example.com',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      bio: 'Art director & photographer 📸',
      isOnline: true,
      lastSeen: 'Active now',
    },
    lastMessage: 'Are we still on for the design review meeting today?',
    time: '10:42 AM',
    unreadCount: 2,
    pinned: true,
  },
  {
    id: 'conv_2',
    user: {
      id: 'u2',
      name: 'Liam Vance',
      username: '@vance_liam',
      email: 'liam@example.com',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
      bio: 'Senior Backend Architect ☕',
      isOnline: false,
      lastSeen: '15m ago',
    },
    lastMessage: 'I merged the websocket server updates. Check it out!',
    time: '09:15 AM',
    unreadCount: 0,
    pinned: true,
  },
  {
    id: 'conv_3',
    user: {
      id: 'u3',
      name: 'Sophia Patel',
      username: '@sophiap',
      email: 'sophia@example.com',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
      bio: 'Product Manager @ Acme',
      isOnline: true,
      lastSeen: 'Active now',
    },
    lastMessage: 'Thanks for the quick response! Loved the mockups.',
    time: 'Yesterday',
    unreadCount: 0,
    pinned: false,
  },
  {
    id: 'conv_4',
    user: {
      id: 'u4',
      name: 'David Kim',
      username: '@dkim_tech',
      email: 'david@example.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Fullstack developer & gamer 🎮',
      isOnline: false,
      lastSeen: '2h ago',
    },
    lastMessage: "Let's sync tomorrow morning at 10 AM.",
    time: '2 days ago',
    unreadCount: 0,
    pinned: false,
  },
  {
    id: 'conv_5',
    user: {
      id: 'u5',
      name: 'Aria Montgomery',
      username: '@ariamont',
      email: 'aria@example.com',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      bio: 'Coffee addict & UI lover ✨',
      isOnline: true,
      lastSeen: 'Active now',
    },
    lastMessage: 'Can you send the Figma link once more?',
    time: '3 days ago',
    unreadCount: 0,
    pinned: false,
  },
];

export const initialStatuses = [
  {
    id: 's1',
    user: {
      id: 'u1',
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    },
    timeAgo: '12m ago',
    viewed: false,
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    caption: 'Sunset vibes at the coast 🌊🌅',
  },
  {
    id: 's2',
    user: {
      id: 'u3',
      name: 'Sophia Patel',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    },
    timeAgo: '45m ago',
    viewed: false,
    mediaUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800',
    caption: 'Product launch celebration! 💻🚀',
  },
  {
    id: 's3',
    user: {
      id: 'u4',
      name: 'David Kim',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    timeAgo: '2h ago',
    viewed: true,
    mediaUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
    caption: 'Midnight coding session 🎧',
  },
];

export const initialCalls = [
  {
    id: 'c1',
    user: {
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    },
    type: 'video', // 'video' | 'audio'
    direction: 'incoming', // 'incoming' | 'outgoing' | 'missed'
    time: 'Today, 11:20 AM',
    duration: '14:20',
  },
  {
    id: 'c2',
    user: {
      name: 'Liam Vance',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    },
    type: 'audio',
    direction: 'missed',
    time: 'Today, 09:30 AM',
    duration: 'Missed',
  },
  {
    id: 'c3',
    user: {
      name: 'Sophia Patel',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    },
    type: 'audio',
    direction: 'outgoing',
    time: 'Yesterday, 04:15 PM',
    duration: '05:12',
  },
  {
    id: 'c4',
    user: {
      name: 'David Kim',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    type: 'video',
    direction: 'outgoing',
    time: 'Oct 8, 02:40 PM',
    duration: '32:45',
  },
];

export const initialMessages = {
  conv_1: [
    {
      id: 'm1',
      senderId: 'u1',
      text: 'Hey! Hope you are having a productive day.',
      time: '10:30 AM',
      isMe: false,
    },
    {
      id: 'm2',
      senderId: 'me',
      text: 'Hey Elena! Yes, working on the new chat interfaces right now.',
      time: '10:32 AM',
      isMe: true,
    },
    {
      id: 'm3',
      senderId: 'u1',
      text: 'Awesome! Did you finish the dark mode aesthetics?',
      time: '10:35 AM',
      isMe: false,
    },
    {
      id: 'm4',
      senderId: 'me',
      text: 'Yes, sleek indigo & slate tones with smooth transitions.',
      time: '10:38 AM',
      isMe: true,
    },
    {
      id: 'm5',
      senderId: 'u1',
      text: 'Are we still on for the design review meeting today?',
      time: '10:42 AM',
      isMe: false,
    },
  ],
};
