const adjectives = [
  'Brave', 'Clever', 'Daring', 'Eager', 'Fancy', 'Gentle', 'Happy', 'Jolly',
  'Kind', 'Lucky', 'Merry', 'Noble', 'Proud', 'Quick', 'Rapid', 'Silent',
  'Swift', 'Tiny', 'Wise', 'Zany', 'Bold', 'Calm', 'Witty', 'Fierce', 'Glad',
  'Bright', 'Cool', 'Epic', 'Grand', 'Keen', 'Lively', 'Mighty', 'Neat',
  'Perfect', 'Royal', 'Smart', 'Cosmic', 'Electric', 'Funky', 'Golden',
  'Heroic', 'Icy', 'Jazzy', 'Lunar', 'Magic', 'Neon', 'Plasma', 'Quantum',
  'Radical', 'Sonic', 'Turbo', 'Ultra', 'Vivid', 'Wild', 'Stellar', 'Fresh'
]

const nouns = [
  'Panda', 'Tiger', 'Eagle', 'Falcon', 'Dragon', 'Phoenix', 'Wolf', 'Bear',
  'Lion', 'Hawk', 'Raven', 'Fox', 'Shark', 'Whale', 'Otter', 'Penguin',
  'Dolphin', 'Koala', 'Sloth', 'Rhino', 'Cobra', 'Viper', 'Python', 'Lynx',
  'Jaguar', 'Panther', 'Cheetah', 'Leopard', 'Cougar', 'Badger', 'Raccoon',
  'Beaver', 'Moose', 'Bison', 'Raven', 'Owl', 'Sparrow', 'Robin', 'Pigeon',
  'Crow', 'Turtle', 'Gecko', 'Iguana', 'Frog', 'Toad', 'Salmon', 'Trout',
  'Pike', 'Bass', 'Squid', 'Octopus', 'Seal', 'Walrus', 'Narwhal', 'Unicorn'
]

export function generateRandomUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 10000)
  return `${adjective}${noun}${number}`
}
