import { prisma } from '@utils/prisma'
import { MsgGroupProps } from '@customTypes/messageTypes'
import z from 'zod'

export async function groupOnText({ bot, msg }: MsgGroupProps) {
  const chatId = msg.chat.id

  const group = await prisma.chatGroup.findUnique({
    where: {
      chatId: chatId
    }
  })

  const text = msg.text?.trim() || ''

  if (!group) {
    const isValid = z.string().uuid().safeParse(text)

    if (!isValid.success) {
      await bot.sendMessage(msg.chat.id, 'Pega la llave de acceso para recibir notificaciones de gastos en este grupo.')
      return
    } else {
      const shareBook = await prisma.shareBook.findUnique({
        where: {
          key: text
        }
      })
      if (!shareBook) {
        await bot.sendMessage(msg.chat.id, 'No se encontró el libro compartido.')
        return
      }

      await prisma.chatGroup.upsert({
        where: {
          chatId: chatId
        },
        update: {
          shareBooks: {
            connect: {
              key: text
            }
          }
        },
        create: {
          chatId: chatId,
          shareBooks: {
            connect: {
              key: text
            }
          }
        }
      })
      await bot.sendMessage(msg.chat.id, 'Grupo registrado correctamente.')
      return
    }
  }
}