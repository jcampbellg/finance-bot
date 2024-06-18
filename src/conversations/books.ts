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

  if (conversationData.action === 'create') {
    const isValid = z.string().min(3).max(50).safeParse(text)
    if (!isValid.success) {
      await bot.sendMessage(userId, 'La respuesta debe ser entre 3 y 50 caracteres.')
      return
    }

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
    const bookId = conversationData.bookId || 0

    const bookToEdit = await prisma.book.findUnique({
      where: {
        id: bookId,
        ownerId: userId
      },
      include: {
        bookSelected: true
      }
    })

    if (!bookToEdit) {
      await prisma.conversation.delete({
        where: {
          chatId: userId
        }
      })
      await bot.sendMessage(userId, 'No se encontró el libro contable.')
      return
    }

    if (conversationData.property === 'title') {
      const isValid = z.string().min(3).max(50).safeParse(text)
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
          inline_keyboard: bookButtons(bookToEdit.bookSelected.length === 0)
        }
      })
      return
    }

    if (conversationData.property === 'currencyA' || conversationData.property === 'currencyB' || conversationData.property === 'currency') {
      const isValid = z.string().regex(/[A-Za-z]+/g).length(3).safeParse(text)
      if (!isValid.success) {
        await bot.sendMessage(userId, 'La moneda debe ser en 3 letras.')
        return
      }

      if (conversationData.property === 'currencyA') {
        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'books',
            data: {
              action: 'edit',
              bookId: bookId,
              property: 'currencyB',
              coinA: text.toUpperCase()
            }
          }
        })

        await bot.sendMessage(userId, 'Moneda B en 3 letras:')
        return
      }

      if (conversationData.property === 'currencyB') {
        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'books',
            data: {
              action: 'edit',
              bookId: bookId,
              property: 'changeAtoB',
              coinA: conversationData.coinA,
              coinB: text.toUpperCase()
            }
          }
        })

        await bot.sendMessage(userId, `1 ${conversationData.coinA} = X ${text.toUpperCase()}\n\nIngresa el valor de X:`)
        return
      }

      if (conversationData.property === 'currency') {
        await prisma.book.update({
          where: {
            id: bookId
          },
          data: {
            currency: text.toUpperCase()
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

        await bot.sendMessage(userId, `Moneda asignada con éxito para libro <b>${bookToEdit.title}</b>.`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: bookButtons(bookToEdit.bookSelected.length === 0)
          }
        })
        return
      }
    }

    if (conversationData.property === 'changeAtoB' || conversationData.property === 'changeBtoA') {
      const number = parseFloat(text)
      if (Number.isNaN(number) || number === 0) {
        await bot.sendMessage(userId, 'El valor debe ser un número mayor de 0.')
        return
      }

      if (conversationData.property === 'changeAtoB') {
        await prisma.conversation.update({
          where: {
            chatId: userId
          },
          data: {
            state: 'books',
            data: {
              action: 'edit',
              bookId: bookId,
              property: 'changeBtoA',
              coinA: conversationData.coinA,
              coinB: conversationData.coinB,
              changeAToB: number
            }
          }
        })

        await bot.sendMessage(userId, `1 ${conversationData.coinB} = X ${conversationData.coinA}\n\nIngresa el valor de X:`)
        return
      }

      if (conversationData.property === 'changeBtoA') {
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

        await prisma.conversionRate.createMany({
          data: [{
            bookId: bookId,
            from: conversationData.coinA,
            to: conversationData.coinB,
            amount: conversationData.changeAToB
          }, {
            bookId: bookId,
            from: conversationData.coinB,
            to: conversationData.coinA,
            amount: number
          }]
        })

        await bot.sendMessage(userId, `Cambio de moneda creado con éxito para libro <b>${bookToEdit.title}</b>.\n\n1 ${conversationData.coinA} = ${conversationData.changeAToB} ${conversationData.coinB}\n1 ${conversationData.coinB} = ${number} ${conversationData.coinA}`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: bookButtons(bookToEdit.bookSelected.length === 0)
          }
        })
        return
      }
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
    const bookToEdit = await prisma.book.findUnique({
      where: {
        id: conversationData.bookId,
        ownerId: userId
      },
      include: {
        bookSelected: true
      }
    })

    if (!bookToEdit) {
      await prisma.conversation.delete({
        where: {
          chatId: userId
        }
      })
      await bot.sendMessage(userId, 'No se encontró el libro contable.')
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

    if (btnPress === 'delete') {
      if (!bookToEdit) {
        await prisma.conversation.delete({
          where: {
            chatId: userId
          }
        })
        await bot.sendMessage(userId, 'No se encontró el libro contable.')
        return
      }

      const isSelected = bookToEdit.bookSelected.length > 0

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

        await bot.sendMessage(userId, `El libro contable "<b>${bookToEdit.title}</b>" está seleccionado.\nNo se puede eliminar.`, {
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

      await bot.sendMessage(userId, `Libro contable "<b>${bookToEdit.title}</b>" eliminado con éxito.`, {
        parse_mode: 'HTML'
      })
      await booksOnStart({ bot, query })
    }

    if (btnPress === 'currency') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'books',
          data: {
            action: 'edit',
            bookId: conversationData.bookId,
          }
        }
      })

      await bot.sendMessage(userId, !!bookToEdit.currency ? `Moneda actual: ${bookToEdit.currency}` : 'No tiene moneda asignada.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Asignar Moneda', callback_data: 'assignCurrency' }, { text: 'Crear Cambio', callback_data: 'changeCurrency' }],
            [{ text: 'Regresar', callback_data: 'back' }]
          ]
        }
      })
      return
    }

    if (btnPress === 'changeCurrency') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'books',
          data: {
            action: 'edit',
            bookId: conversationData.bookId,
            property: 'currencyA',
          }
        }
      })

      await bot.sendMessage(userId, 'Moneda A en 3 letras:')
      return
    }

    if (btnPress === 'assignCurrency') {
      await prisma.conversation.update({
        where: {
          chatId: userId
        },
        data: {
          state: 'books',
          data: {
            action: 'edit',
            bookId: conversationData.bookId,
            property: 'currency',
          }
        }
      })

      await bot.sendMessage(userId, '<i>Es importante que tengas los cambios de monedas listos para realizar su conversión.</i>\n\nMoneda en 3 letras:', {
        parse_mode: 'HTML'
      })
      return
    }
  }
}

export function bookButtons(canSelect: boolean): TelegramBot.InlineKeyboardButton[][] {
  if (canSelect) return [
    [{ text: 'Seleccionar', callback_data: `select` }, { text: 'Renombrar', callback_data: `title` }],
    [{ text: 'Moneda', callback_data: `currency` }, { text: 'Eliminar', callback_data: `delete` }],
    [{ text: 'Regresar', callback_data: `back` }]
  ]
  return [
    [{ text: 'Renombrar', callback_data: `title` }],
    [{ text: 'Moneda', callback_data: `currency` }, { text: 'Eliminar', callback_data: `delete` }],
    [{ text: 'Regresar', callback_data: `back` }]
  ]
}