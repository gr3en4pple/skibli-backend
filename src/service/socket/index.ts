import type { Socket } from 'socket.io'
import { sendMessage } from '@/service/chat'

class ChatSocket {
  private socket: Socket
  constructor(socket: Socket) {
    this.socket = socket
    this.onSendMessageEvent(socket)
    this.onDisconnect(socket)
  }

  public async onReceiveMessage(
    socket: Socket,
    data: {
      message: string
      senderId: string
      toId: string
    }
  ) {
    const roomId = await sendMessage({
      userId1: data.senderId,
      userId2: data.toId,
      senderId: data.senderId,
      message: data.message
    })

    if (!roomId) return

    socket.to(roomId).emit('receive_message', {
      message: data.message,
      senderId: data.senderId,
      toId: data.toId
    })
  }

  public onSendMessageEvent(socket: Socket) {
    socket.on('send_message', (data) => {
      console.log('data:', data)
      this.onReceiveMessage(socket, data)
    })
  }

  public onDisconnect(socket: Socket) {
    socket.on('disconnect', () => {
      console.log('User offline:', this.socket.id)
    })
  }
}

export { ChatSocket }
