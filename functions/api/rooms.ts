export async function onRequestGet() {
  return Response.json({
    rooms: [
      { id: 'sunset-7', name: 'Sunset Arena', players: 6, capacity: 10, type: 'public' },
      { id: 'glow-3', name: 'Glow Circuit', players: 4, capacity: 10, type: 'public' },
      { id: 'campfire-9', name: 'Campfire Finals', players: 9, capacity: 10, type: 'public' }
    ]
  })
}
