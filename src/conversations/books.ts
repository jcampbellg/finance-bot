import { MsgAndQueryProps, MsgProps, QueryProps } from '@customTypes/messageTypes'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'
import z from 'zod'

export async function booksOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  const books = await prisma.book.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          share: {
            some: {
              userId: userId
            }
          }
        }
      ]
    },
    include: {
      bookSelected: true
    }
  })

  await prisma.conversation.update({
    data: {
      state: 'books',
      data: {}
    },
    where: {
      chatId: userId
    }
  })

  await bot.sendMessage(userId, `Selecciona, edita o crea un libro contable.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Crear Nuevo Libro', callback_data: 'create' }],
        ...books.map(book => ([{
          text: `${book.bookSelected.length > 0 ? '⦿ ' : ''}${book.title}`,
          callback_data: `${book.id}`
        }]))
      ]
    }
  })
  return
}

export async function booksOnText({ bot, msg }: MsgProps) {
  const userId = msg.chat.id
  const text = msg.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  const isValid = z.string().min(3).max(50).safeParse(text)

  if (!isValid.success) {
    await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
    return
  }

  if (conversationData.action === 'create') {
    const newBook = await prisma.book.create({
      data: {
        title: text,
        ownerId: userId
      }
    })

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'books',
        data: {
          action: 'edit',
          bookId: newBook.id
        }
      }
    })

    await bot.sendMessage(userId, `Libro contable "<b>${newBook.title}</b>" creado con éxito.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: bookButtons(true)
      }
    })
    return
  }

  if (conversationData.action === 'edit') {
    if (conversationData.property === 'title') {
      const bookId = conversationData.bookId

      const oldBook = await prisma.book.findUnique({
        where: {
          id: bookId,
          ownerId: userId
        },
        include: {
          bookSelected: true
        }
      })

      if (!oldBook) {
        await prisma.conversation.delete({
          where: {
            chatId: userId
          }
        })
        await bot.sendMessage(userId, 'No se encontró el libro contable.')
        return
      }

      await prisma.book.update({
        where: {
          id: bookId
        },
        data: {
          title: text
        }
      })

      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'books',
          data: {
            action: 'edit',
            bookId: bookId
          }
        }
      })

      await bot.sendMessage(userId, `Libro contable renombrado:\n\n<s>${oldBook.title}</s>\n<b>${text}</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: bookButtons(oldBook.bookSelected.length === 0)
        }
      })
      return
    }
  }
}

export async function booksOnCallbackQuery({ bot, query }: QueryProps) {
  const userId = query.from.id
  const btnPress = query.data

  if (btnPress === 'back') {
    await booksOnStart({ bot, query })
    return
  }

  if (btnPress === 'create') {
    await prisma.conversation.update({
      data: {
        state: 'books',
        data: {
          action: 'create'
        }
      },
      where: {
        chatId: userId
      }
    })

    await bot.sendMessage(userId, 'Ingresa el titulo para el nuevo libro contable:')
    return
  }

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  if (!conversation) return

  const conversationData: any = conversation.data || {}

  if (!conversationData.action) {
    // btn press is a book id
    const bookId = parseInt(btnPress)
    if (Number.isNaN(bookId)) return

    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'books',
        data: {
          action: 'edit',
          bookId: bookId
        }
      }
    })

    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
        ownerId: userId
      },
      include: {
        bookSelected: true
      }
    })

    if (!book) return

    await bot.sendMessage(userId, `Editar <b>${book.title}</b>:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: bookButtons(book.bookSelected.length === 0)
      }
    })
    return
  }

  if (conversationData.action === 'edit') {
    if (btnPress === 'title') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'books',
          data: {
            bookId: conversationData.bookId,
            action: 'edit',
            property: 'title'
          }
        }
      })

      await bot.sendMessage(userId, 'Ingresa el nuevo titulo para el libro contable:')
      return
    }

    if (btnPress === 'delete') {
      const bookToDelete = await prisma.book.findUnique({
        where: {
          id: conversationData.bookId,
          ownerId: userId
        },
        include: {
          bookSelected: true
        }
      })

      if (!bookToDelete) {
        await prisma.conversation.delete({
          where: {
            chatId: userId
          }
        })
        await bot.sendMessage(userId, 'No se encontró el libro contable.')
        return
      }

      const isSelected = bookToDelete.bookSelected.length > 0

      if (isSelected) {
        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'books',
            data: {
              action: 'edit',
              bookId: conversationData.bookId
            }
          }
        })

        await bot.sendMessage(userId, `El libro contable "<b>${bookToDelete.title}</b>" está seleccionado.\nNo se puede eliminar.`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: bookButtons(false)
          }
        })
        return
      }

      await prisma.book.delete({
        where: {
          id: conversationData.bookId
        }
      })

      await bot.sendMessage(userId, `Libro contable "<b>${bookToDelete.title}</b>" eliminado con éxito.`, {
        parse_mode: 'HTML'
      })
      await booksOnStart({ bot, query })
    }

    if (btnPress === 'currency') {

    }
  }
}

export function bookButtons(canSelect: boolean): TelegramBot.InlineKeyboardButton[][] {
  if (canSelect) return [
    [{ text: 'Seleccionar', callback_data: `select` }, { text: 'Renombrar', callback_data: `title` }],
    [{ text: 'Monedas', callback_data: `currency` }, { text: 'Eliminar', callback_data: `delete` }],
    [{ text: 'Regresar', callback_data: `back` }]
  ]
  return [
    [{ text: 'Renombrar', callback_data: `title` }],
    [{ text: 'Monedas', callback_data: `currency` }, { text: 'Eliminar', callback_data: `delete` }],
    [{ text: 'Regresar', callback_data: `back` }]
  ]
}