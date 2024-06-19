import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import { accountsOnStart } from '@conversations/budget/accounts'
import { categoriesOnStart } from './budget/categories'

export async function budgetOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      books: {
        where: {
          OR: [
            { ownerId: userId },
            {
              shares: {
                some: {
                  shareWithUserId: userId
                }
              }
            }
          ]
        }
      }
    }
  })

  if (!user) {
    await bot.sendMessage(userId, 'No se encontró el usuario.\n\n Usa /start para comenzar.')
    return
  }

  const book = user.books.find(book => book.id === user.bookSelectedId)

  if (!book) {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'waitingForCommand',
        data: {}
      }
    })
    await bot.sendMessage(userId, '<i>Primero necesitas seleccionar un libro contable. Usa /libro.</i>', { parse_mode: 'HTML' })
    return
  }

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'budget',
      data: {}
    }
  })

  await bot.sendMessage(userId, `¡Vamos a configurar el prespuesto para <b>${book.title}</b>! 📚`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Cuentas', callback_data: 'accounts' }, { text: 'Categorias', callback_data: 'categories' }],
        [{ text: 'Presupuestos', callback_data: 'budget' }],
      ]
    }
  })
  return
}

export async function bundgetOnCallbackQuery({ bot, query }: QueryProps) {
  const btnPress = query.data

  if (btnPress === 'accounts') {
    accountsOnStart({ bot, query })
    return
  }

  if (btnPress === 'categories') {
    categoriesOnStart({ bot, query })
    return
  }
}