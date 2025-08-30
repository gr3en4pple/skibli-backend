import { JwtPayload } from 'jsonwebtoken'
import { findUser } from '@/service/auth'
import { adminDb, CollectionNames } from '@/firebase'
import { Response } from 'express'
import { DocumentData, FieldValue, Timestamp } from 'firebase-admin/firestore'
import ms from 'ms'

const getAllChatMembers = async (res: Response) => {
  try {
    const authCollection = adminDb.collection(CollectionNames.auth_users)
    const snapshot = await authCollection.get()

    if (!snapshot)
      return res.status(400).json({
        error: true,
        message: 'Error'
      })

    const members = snapshot.docs.map((doc) => {
      const data = doc.data()
      delete data?.password
      return {
        uid: doc.id,
        ...data
      }
    })
    return res.status(200).json({
      success: true,
      message: 'Successfully!',
      data: members
    })
  } catch (error: any) {
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const getRoomChatHistory = async (
  { roomId, userId }: { roomId: string; userId: string },
  res: Response
) => {
  try {
    const userDoc = adminDb.collection(CollectionNames.auth_users).doc(userId)
    const userSnapshot = await userDoc.get()

    if (!userSnapshot || !userSnapshot.exists)
      return res.status(404).json({
        error: true,
        message: 'Not Found User'
      })
    const roomDoc = adminDb.collection(CollectionNames.chats).doc(roomId)
    const roomMessagesSnapshot = await roomDoc
      .collection(CollectionNames.messages)
      .orderBy('createdAt', 'asc')
      .get()

    return res.status(200).json({
      success: true,
      message: 'Successfully!',
      data: roomMessagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
    })
  } catch (error: any) {
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

function createRoomId(userId1: string, userId2: string) {
  return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`
}

const createOrFindRoomId = async (userId1: string, userId2: string) => {
  const roomId = createRoomId(userId1, userId2)
  const roomDoc = adminDb.collection(CollectionNames.chats).doc(roomId)

  const snapshot = await roomDoc.get()
  // create room if not exists
  if (!snapshot.exists) {
    await roomDoc.set({
      createdAt: FieldValue.serverTimestamp()
    })
  }

  return roomId
}

const sendMessage = async ({
  userId1,
  userId2,
  senderId,
  message
}: {
  userId1: string
  userId2: string
  senderId: string
  message: string
}) => {
  try {
    const userDoc = adminDb.collection(CollectionNames.auth_users).doc(senderId)
    const userData = await userDoc.get()
    if (!userData || !userData.exists) return null

    if ('password' in userData) delete userData.password

    const createdRoomId = await createOrFindRoomId(userId1, userId2)

    const messagesCollection = adminDb
      .collection(CollectionNames.chats)
      .doc(createdRoomId)
      .collection(CollectionNames.messages)
    const messageResponse = await messagesCollection.add({
      sender: userData.data(),
      senderId,
      message,
      createdAt: Timestamp.now()
    })

    return {
      roomId: createdRoomId,
      messageId: messageResponse.id
    }
  } catch (error) {
    console.log('error:', error)
  }
}
export { getAllChatMembers, getRoomChatHistory, sendMessage }
