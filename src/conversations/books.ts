import { MsgAndQueryProps, MsgProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import { isTitleValid } from '@utils/isValid'
import { prisma } from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'

const maxBooks = 10

export async function booksOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, userId } = await auth({ msg, bot, query } as MsgAndQueryProps, true)
  if (!user) return

  await prisma.conversation.update({
    data: {
      state: 'books',
      data: {}
    },
    where: {
      chatId: userId
    }
  })

  const books = await prisma.book.findMany({
    where: {
      OR: [
        {
          ownerId: userId
        },
        {
          shares: {
            some: {
              shareWithUserId: userId
            }
          }
        }
      ]
    },
    include: {
      shares: true
    },
    orderBy: {
      title: 'asc'
    }
  })

  const ownBooksCount = await prisma.book.count({
    where: {
      ownerId: userId
    }
  })

  await bot.sendMessage(userId, `Selecciona o crea un libro contable.`, {
    reply_markup: {
      inline_keyboard: [
        ownBooksCount < maxBooks ? [{ text: 'Crear Nuevo Libro', callback_data: 'create' }] : [],
        ...books.map(book => ([{
          text: `${user.bookSelectedId === book.id ? '⦿ ' : ''}${book.title}${book.shares.length ? ' 🤝' : ''}`,
          callback_data: `${book.id}`
        }]))
      ]
    }
  })
  return
}

export async function booksOnText({ bot, msg }: MsgProps) {
  const { user, book, userId } = await auth({ msg, bot }, true)
  if (!user) return
  if (!book) return

  const text = msg.text?.trim() || ''

  const conversation = await prisma.conversation.findUnique({
    where: {
      chatId: userId
    }
  })

  const conversationData: any = conversation?.data || {}

  if (conversationData.action === 'create') {
    const isValid = isTitleValid(text)
    if (!isValid.success) {
      await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
      return
    }

    const newBook = await prisma.book.create({
      data: {
        title: text,
        ownerId: userId,
        accounts: {
          create: {
            description: 'Efectivo'
          }
        }
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
    const bookId = conversationData.bookId || 0

    const bookToEdit = await prisma.book.findUnique({
      where: {
        id: bookId,
      },
      include: {
        owner: true
      }
    })

    if (!bookToEdit) {
      await bot.sendMessage(userId, '<i>No se encontró el libro contable.</i>', { parse_mode: 'HTML' })
      await booksOnStart({ bot, msg })
      return
    }

    if (conversationData.property === 'title') {
      const isValid = isTitleValid(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
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

      await bot.sendMessage(userId, `Libro contable renombrado:\n\n<s>${bookToEdit.title}</s>\n<b>${text}</b>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: bookButtons(user.bookSelectedId !== bookToEdit.id)
        }
      })
      return
    }
  }
}

export async function booksOnCallbackQuery({ bot, query }: QueryProps) {
  const { user, userId } = await auth({ query, bot }, true)
  if (!user) return

  const btnPress = query.data

  if (btnPress === 'back') {
    await booksOnStart({ bot, query })
    return
  }

  if (btnPress === 'create') {
    const ownBooksCount = await prisma.book.count({
      where: {
        ownerId: userId
      }
    })

    if (ownBooksCount >= maxBooks) {
      await bot.sendMessage(userId, `No puedes tener más de ${maxBooks} libros contables.`)
      await booksOnStart({ bot, query })
      return
    }

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
      chatId: query.message.chat.id
    }
  })

  const conversationData: any = conversation?.data || {}

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
      },
      include: {
        owner: true
      }
    })

    if (!book) {
      await bot.sendMessage(userId, '<i>No se encontró el libro contable.</i>', { parse_mode: 'HTML' })
      await booksOnStart({ bot, query })
      return
    }

    await bot.sendMessage(userId, `Editar <b>${book.title}</b>:`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: bookButtons(user.bookSelectedId !== book.id)
      }
    })
    return
  }

  if (conversationData.action === 'edit') {
    const bookToEdit = await prisma.book.findUnique({
      where: {
        id: conversationData.bookId || 0,
      },
      include: {
        owner: true
      }
    })

    if (!bookToEdit) {
      await bot.sendMessage(userId, '<i>No se encontró el libro contable.</i>', { parse_mode: 'HTML' })
      await booksOnStart({ bot, query })
      return
    }

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

    if (btnPress === 'select') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'books',
          data: {
            action: 'edit',
            bookId: bookToEdit.id
          }
        }
      })

      await prisma.user.update({
        where: {
          id: userId
        },
        data: {
          bookSelectedId: bookToEdit.id
        }
      })

      await bot.sendMessage(userId, `Libro contable "<b>${bookToEdit.title}</b>" seleccionado con éxito.`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: bookButtons(false)
        }
      })
      return
    }

    if (btnPress === 'delete') {
      const isSelected = bookToEdit.owner.bookSelectedId === bookToEdit.id

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

        await bot.sendMessage(userId, `El libro contable "<b>${bookToEdit.title}</b>" está seleccionado.\n\n<i>No se puede eliminar.</i>`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: bookButtons(false)
          }
        })
        return
      }

      if (Number(bookToEdit.ownerId) !== userId) {
        await bot.sendMessage(userId, `El libro contable "<b>${bookToEdit.title}</b>" no te pertenece.\n\n<i>No se puede eliminar.</i>`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: bookButtons(user.bookSelectedId !== bookToEdit.id)
          }
        })
        return
      }

      await bot.sendMessage(userId, `¿Estás seguro de eliminar el libro contable "<b>${bookToEdit.title}</b>"?\n\n<i>Se eliminaran todas tus cuentas y transacciones vinculadas a este libro.</i>`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Si', callback_data: 'deleteYes' }, { text: 'No', callback_data: 'deleteNo' }]
          ]
        }
      })
      return
    }

    if (btnPress === 'deleteNo') {
      await bot.sendMessage(userId, `Editar <b>${bookToEdit.title}</b>:`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: bookButtons(user.bookSelectedId !== bookToEdit.id)
        }
      })
      return
    }

    if (btnPress === 'deleteYes') {
      await prisma.exchangeRate.deleteMany({
        where: {
          bookId: conversationData.bookId
        }
      })

      await prisma.shareBook.deleteMany({
        where: {
          bookId: conversationData.bookId
        }
      })

      await prisma.expense.deleteMany({
        where: {
          bookId: conversationData.bookId
        }
      })

      await prisma.limit.deleteMany({
        where: {
          category: {
            bookId: conversationData.bookId
          }
        }
      })

      await prisma.salary.deleteMany({
        where: {
          income: {
            bookId: conversationData.bookId
          }
        }
      })

      await prisma.income.deleteMany({
        where: {
          bookId: conversationData.bookId
        }
      })

      await prisma.category.deleteMany({
        where: {
          bookId: conversationData.bookId
        }
      })

      await prisma.account.deleteMany({
        where: {
          bookId: conversationData.bookId
        }
      })

      await prisma.book.delete({
        where: {
          id: conversationData.bookId
        }
      })

      await bot.sendMessage(userId, `Libro contable "<b>${bookToEdit.title}</b>" eliminado con éxito.`, {
        parse_mode: 'HTML'
      })
      await booksOnStart({ bot, query })
      return
    }
  }
}

export function bookButtons(canSelect: boolean): TelegramBot.InlineKeyboardButton[][] {
  if (canSelect) return [
    [{ text: 'Seleccionar', callback_data: `select` }],
    [{ text: 'Renombrar', callback_data: `title` }, { text: 'Eliminar', callback_data: `delete` }],
    [{ text: 'Regresar', callback_data: `back` }]
  ]
  return [
    [{ text: 'Renombrar', callback_data: `title` }, { text: 'Eliminar', callback_data: `delete` }],
    [{ text: 'Regresar', callback_data: `back` }]
  ]
}