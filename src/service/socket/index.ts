import type { Socket } from 'socket.io'
import { sendMessage } from '@/service/chat'
import { Timestamp } from 'firebase-admin/firestore'

class ChatSocket {
  private socket: Socket
  constructor(socket: Socket) {
    this.socket = socket
    this.onJoinRoom(this.socket)
    this.onLeaveRoom(this.socket)
    this.onSendMessageEvent(this.socket)
    this.onDisconnect(this.socket)
  }

  public onJoinRoom(socket: Socket) {
    socket.on('join_room', (roomId) => {
      socket.join(roomId)
    })
  }

  public onLeaveRoom(socket: Socket) {
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId)
    })
  }

  public onSendMessageEvent(socket: Socket) {
    socket.on('send_message', async (data) => {
      const sendMessageResponse = await sendMessage({
        userId1: data.senderId,
        userId2: data.toId,
        senderId: data.senderId,
        message: data.message
      })

      if (!sendMessageResponse?.roomId || !sendMessageResponse?.messageId)
        return
      const { roomId, messageId } = sendMessageResponse

      const messageData = {
        message: data.message,
        senderId: data.senderId,
        toId: data.toId,
        createdAt: Timestamp.now(),
        id: messageId
      }

      socket.emit('receive_message', messageData)
      socket.to(roomId).emit('receive_message', messageData)
    })
  }

  public onDisconnect(socket: Socket) {
    socket.on('disconnect', () => {
      console.log('User offline:', this.socket.id)
    })
  }
}

export { ChatSocket }
