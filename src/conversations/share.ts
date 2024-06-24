import { prisma } from '@utils/prisma'
import { MsgAndQueryProps, MsgProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import z from 'zod'
import { waitingForCommandOnStart } from './waitingForCommand'

export async function shareOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ bot, msg, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'share',
      data: {}
    }
  })

  await bot.sendMessage(userId, 'Compartir libro contable con otro usuario o grupo', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Crear llave', callback_data: 'create' }],
        [{ text: 'Ingresar llave', callback_data: 'access' }],
        [{ text: 'Dejar de compartir', callback_data: 'stop' }]
      ]
    }
  })
  return
}

export async function shareOnText({ bot, msg }: MsgProps) {
  const { user, book, userId } = await auth({ bot, msg })
  if (!user) return
  if (!book) return

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })
  const text = msg.text?.trim() || ''
  const conversationData: any = conversation?.data || {}

  if (conversationData.action === 'access') {
    const isValid = z.string().uuid().safeParse(text)

    if (!isValid.success) {
      await bot.sendMessage(msg.chat.id, 'Llave de acceso inválida.')
      return
    }

    const shareBook = await prisma.shareBook.findUnique({
      where: {
        key: text
      }
    })
    if (!shareBook) {
      await bot.sendMessage(msg.chat.id, 'No se encontró el libro compartido.')
      return
    }

    await prisma.shareBook.update({
      where: {
        key: text
      },
      data: {
        shareWithUserId: userId
      }
    })

    await bot.sendMessage(msg.chat.id, 'Libro compartido correctamente.')
    await waitingForCommandOnStart({ bot, msg })
    return
  }
}

export async function shareOnCallbackQuery({ bot, query }: QueryProps) {
  const { user, book, userId } = await auth({ bot, query })
  if (!user) return
  if (!book) return

  const btnText = query.data

  if (btnText === 'create') {
    const share = await prisma.shareBook.create({
      data: {
        bookId: book.id
      }
    })

    await bot.sendMessage(userId, `Copia la llave de acceso:\n\n<code>${share.key}</code>\n\nPegala en la cuenta o grupo.`, {
      parse_mode: 'HTML'
    })
    return
  }

  if (btnText === 'access') {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'share',
        data: {
          action: 'access'
        }
      }
    })

    await bot.sendMessage(userId, 'Pega la llave de acceso.')
    return
  }

  if (btnText === 'stop') {
    await prisma.shareBook.deleteMany({
      where: {
        bookId: book.id
      }
    })

    await bot.sendMessage(userId, 'Dejaste de compartir este libro.')
    await waitingForCommandOnStart({ bot, query })
    return
  }
}