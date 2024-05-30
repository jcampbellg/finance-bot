import TelegramBot from 'node-telegram-bot-api'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import numeral from 'numeral'
import * as dotenv from 'dotenv'
import prisma from '@utils/prisma'
import { AIAmount, AIAmountAndCurrency, AISaveIncome, AIStatement, AITransaction } from '@utils/AI'
import { FileType, Prisma } from '@prisma/client'
import { ChatCompletionMessageParam } from 'openai/resources'
dotenv.config()

if (process.env.botToken === undefined) {
  throw new Error('botToken is not defined')
}

if (process.env.userWhitelist === undefined) {
  throw new Error('userWhitelist is not defined')
}

if (process.env.timezone === undefined) {
  throw new Error('timezone is not defined')
}

dayjs.extend(utc)
dayjs.extend(timezone)

const userWhitelist: number[] = JSON.parse(process.env.userWhitelist)

const token = process.env.botToken

const bot = new TelegramBot(token, { polling: true })

const paymentMethod = {
  CASH: 'por efectivo',
  CREDITCARD: 'con tarjeta de crédito',
  DEBITCARD: 'con tarjeta de débito',
  TRANSFER: 'por transferencia'
}

const commands = [{
  command: 'estado',
  description: 'Crear o edita tus estados de cuentas mensuales.'
}, {
  command: 'ingreso',
  description: 'Crear o edita tus ingresos mensuales.'
}, {
  command: 'categoria',
  description: 'Crear o edita tus categorías de gastos.'
}, {
  command: 'resumen',
  description: 'Ver un resumen de tus estado de cuenta actual.'
}, {
  command: 'fijos',
  description: 'Ver tus pagos fijos.'
}, {
  command: 'cambio',
  description: 'Establecer el cambio de moneda actual.'
}, {
  command: 'ultima',
  description: 'Ver y editar la última transacción.'
}]

bot.on('message', async (msg) => {
  if (!userWhitelist.includes(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, `You, ${msg.chat.id} are not authorized to use this bot.`)
    return
  }

  bot.sendChatAction(msg.chat.id, 'typing')

  if (msg.text === '/start') {
    await bot.setMyCommands(commands, {
      scope: {
        type: 'chat',
        chat_id: msg.chat.id
      },
      language_code: 'en'
    })

    await bot.setMyCommands(commands, {
      scope: {
        type: 'chat',
        chat_id: msg.chat.id
      },
      language_code: 'es'
    })

    await bot.setMyCommands(commands, {
      scope: {
        type: 'all_group_chats',
      },
      language_code: 'en'
    })

    await bot.setMyCommands(commands, {
      scope: {
        type: 'all_group_chats',
      },
      language_code: 'es'
    })

    await bot.setMyCommands(commands, {
      scope: {
        type: 'all_private_chats',
      },
      language_code: 'en'
    })

    await bot.setMyCommands(commands, {
      scope: {
        type: 'all_private_chats',
      },
      language_code: 'es'
    })

    await bot.getMyCommands({ type: 'chat', chat_id: msg.chat.id }, msg.from?.language_code || 'en')
    await bot.getMyCommands({ type: 'all_group_chats' }, msg.from?.language_code || 'en')
    await bot.getMyCommands({ type: 'all_private_chats' }, msg.from?.language_code || 'en')

    const userExists = await prisma.chat.findUnique({
      where: {
        chatId: msg.chat.id
      }
    })

    if (!!userExists) {
      await bot.sendMessage(msg.chat.id, 'Ya tienes una cuenta creada.\nlanguages_code: ' + msg.from?.language_code || 'No language code')
      return
    }

    await prisma.chat.create({
      data: {
        fullName: msg.chat.first_name || msg.chat.username || msg.chat.title || msg.chat.description || '',
        chatId: msg.chat.id,
        chatSubject: '',
        chatSubSubject: [],
        chatHistory: []
      }
    })

    await bot.sendMessage(msg.chat.id, 'Empezemos con /estado para crear un estado de cuenta mensual.')
    return
  }

  const chat = await prisma.chat.findUnique({
    where: {
      chatId: msg.chat.id
    },
    include: {
      statement: true
    }
  })

  if (!chat) {
    await bot.sendMessage(msg.chat.id, 'Primero debes iniciar el bot con el comando /start.')
    return
  }

  if (!msg.text && !msg.voice && !chat.chatSubSubject.some(s => s === 'adjuntar') && chat.chatSubject !== 'adjuntar') {
    bot.sendMessage(msg.chat.id, 'Envía un mensaje de texto o de voz.')
    return
  }

  let userText = msg.text || ''

  if (msg.voice) {
    const link = await bot.getFileLink(msg.voice.file_id)
    const audioFile = await fetch(link)

    const transcription = await openAi.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "text"
    })

    // @ts-ignore
    userText = transcription
  }

  // Estado de cuenta
  if (userText === '/estado') {
    await chatUpdate(msg.chat.id, { chatSubject: 'estado', chatSubSubject: [!!chat.statement ? 'queres cambiarlo' : 'mes y año'] })

    if (!!chat.statement) {
      const monthInSpanish = dayjs().locale('es').month(chat.statement.month - 1).format('MMMM')
      const year = chat.statement.year
      await bot.sendMessage(msg.chat.id, `Tu estado de cuenta actual es para el mes de ${monthInSpanish} del año ${year}.\n\n¿Quieres cambiarlo?\n/si\n/no`)
      return
    }

    await bot.sendMessage(msg.chat.id, 'No tienes estado de cuenta. Escribe el mes y año para el estado de cuenta:')
    return
  }

  if (chat.chatSubject === 'estado') {
    switch (chat.chatSubSubject[0]) {
      case 'mes y año':
        const botMessageJSON = await AIStatement(userText)

        if ('error' in botMessageJSON) {
          await chatUpdate(msg.chat.id)
          await bot.sendMessage(msg.chat.id, botMessageJSON.error)
          return
        }

        const month = botMessageJSON.month
        const year = botMessageJSON.year
        // Check if the statement already exists
        const statementExists = await prisma.statement.findFirst({
          where: {
            month,
            year
          }
        })

        const monthInSpanish = dayjs().locale('es').month(month - 1).format('MMMM')

        if (!!statementExists) {
          await chatUpdate(msg.chat.id, { statementId: statementExists.id, chatSubject: '', chatSubSubject: [], chatHistory: [] })
          await bot.sendMessage(msg.chat.id, `Cambiando el estado de cuenta para el mes de ${monthInSpanish} del año ${year}.`)
          return
        }

        const newStatement = await prisma.statement.create({
          data: {
            month,
            year
          }
        })

        if (chat.statement) {
          const oldCategories = await prisma.category.findMany({
            where: {
              statementId: chat.statement.id
            }
          })

          const oldIncomes = await prisma.income.findMany({
            where: {
              statementId: chat.statement.id
            }
          })

          await prisma.statement.update({
            where: {
              id: newStatement.id
            },
            data: {
              categories: {
                createMany: {
                  data: oldCategories.map(c => {
                    return {
                      description: c.description,
                      emoji: c.emoji,
                      isFixed: c.isFixed,
                      limit: c.limit,
                      currency: c.currency,
                      notes: c.notes
                    }
                  })
                }
              },
              incomes: {
                createMany: {
                  data: oldIncomes.map(i => {
                    return {
                      source: i.source,
                      amount: i.amount,
                      currency: i.currency
                    }
                  })
                }
              }
            }
          })
        }

        await chatUpdate(msg.chat.id, { statementId: newStatement.id, chatSubject: '', chatSubSubject: [], chatHistory: [] })

        await bot.sendMessage(msg.chat.id, `Estado de cuenta creado para el mes de ${monthInSpanish} del año ${year}.`)
        return
      case 'queres cambiarlo':
        if (userText === '/si') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['mes y año'] })

          await bot.sendMessage(msg.chat.id, 'Escribe el mes y año para el estado de cuenta:')
          return
        }

        if (userText === '/no') {
          await chatUpdate(msg.chat.id)

          await bot.sendMessage(msg.chat.id, 'Entendido.')
          return
        }
        break
    }
  }

  if (!chat.statement) {
    await bot.sendMessage(msg.chat.id, 'Primero debes crear un estado de cuenta con el comando /estado.')
    return
  }

  const hnlToDollar = chat.statement.hnlToDollar
  const dollarToHNL = chat.statement.dollarToHNL

  // Ingreso
  if (userText === '/ingreso') {
    await chatUpdate(msg.chat.id, { chatSubject: 'ingreso', chatSubSubject: ['crear o ver'] })

    await bot.sendMessage(msg.chat.id, '¿Quieres crear un ingreso o ver los ingresos actuales?\n\n/crear\n\n/ver')
    return
  }

  if (chat.chatSubject === 'ingreso') {
    switch (chat.chatSubSubject[0]) {
      case 'crear o ver':
        if (userText === '/crear') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['crear', 'fuente'] })

          await bot.sendMessage(msg.chat.id, '¿Cuál es la fuente de tu ingreso?')
          return
        }
        if (userText === '/ver') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['ver'] })

          const incomes = await prisma.income.findMany({
            where: {
              statementId: chat.statement.id
            },
            orderBy: {
              createdAt: 'asc'
            }
          })

          if (incomes.length === 0) {
            await bot.sendMessage(msg.chat.id, 'No tienes ingresos registrados.')
            return
          }

          const incomesText = incomes.map((income, i) => {
            return `/${i + 1}. <b>${income.source}</b>\n${income.amount} ${income.currency}`
          }).join('\n\n')

          const totalInUSD = incomes.reduce((acc, income) => {
            if (income.currency === 'HNL') {
              return acc + (income.amount * hnlToDollar)
            }
            return acc + income.amount
          }, 0)

          const totalInHNL = incomes.reduce((acc, income) => {
            if (income.currency === 'USD') {
              return acc + (income.amount * dollarToHNL)
            }
            return acc + income.amount
          }, 0)

          await bot.sendMessage(msg.chat.id, `Presiona el /# para editar.\n\n${incomesText}\n\nTotal HNL: ${numeral(totalInHNL).format('0,0.00')}\nTotal USD: ${numeral(totalInUSD).format('0,0.00')}`, { parse_mode: 'HTML' })
          return
        }
        break
      case 'crear':
        switch (chat.chatSubSubject[1]) {
          case 'fuente':
            // Ahorita nos esta contestando la fuente del ingreso
            await chatUpdate(msg.chat.id, { chatSubSubject: ['crear', 'monto'], chatHistory: [userText] })

            await bot.sendMessage(msg.chat.id, '¿Cuánto es el ingreso?')
            return
          case 'monto':
            const botMessageJSON = await AISaveIncome(chat.chatHistory[0], userText)

            if ('error' in botMessageJSON) {
              await chatUpdate(msg.chat.id)
              await bot.sendMessage(msg.chat.id, botMessageJSON.error)
              return
            }

            const income = await prisma.income.create({
              data: {
                source: botMessageJSON.source,
                currency: botMessageJSON.currency,
                amount: botMessageJSON.amount,
                statementId: chat.statement.id
              }
            })

            await chatUpdate(msg.chat.id)

            await bot.sendMessage(msg.chat.id, `Ingreso creado para ${income.source}.\n\n${numeral(botMessageJSON.amount).format('0,0.00')} ${income.currency}`)
            return
        }
        break
      case 'ver':
        if (userText.match(/^\/\d+$/)) {
          const index = parseInt(userText.replace('/', '')) - 1

          const incomeToEdit = await prisma.income.findMany({
            take: 1,
            skip: index,
            where: {
              statementId: chat.statement.id
            },
            orderBy: {
              createdAt: 'asc'
            }
          })

          if (incomeToEdit.length === 0) {
            await bot.sendMessage(msg.chat.id, 'No se encontró el ingreso.')
            return
          }

          await chatUpdate(msg.chat.id, { chatSubSubject: ['editar', `${incomeToEdit[0].id}`] })

          await bot.sendMessage(msg.chat.id, `<b>${incomeToEdit[0].source}</b>\n${numeral(incomeToEdit[0].amount).format('0,0.00')} ${incomeToEdit[0].currency}\n\n¿Qué quieres hacer?\n\n/editar monto\n\n/eliminar`, { parse_mode: 'HTML' })
          return
        }
        break
      case 'editar':
        const incomeEditing = await prisma.income.findUnique({
          where: {
            id: parseInt(chat.chatSubSubject[1]),
          }
        })

        if (!incomeEditing) {
          await bot.sendMessage(msg.chat.id, 'No se encontró el ingreso.')
          return
        }

        if (chat.chatSubSubject[2] === 'monto') {
          const editJSON = await AIAmountAndCurrency(userText)

          if ('error' in editJSON) {
            await chatUpdate(msg.chat.id)
            await bot.sendMessage(msg.chat.id, editJSON.error)
            return
          }

          await prisma.income.update({
            where: {
              id: incomeEditing.id
            },
            data: {
              amount: editJSON.amount,
              currency: editJSON.currency
            }
          })

          await chatUpdate(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Monto actualizado para ${incomeEditing.source}.\n\n${numeral(editJSON.amount).format('0,0.00')} ${incomeEditing.currency}`)
          return
        }

        if (userText === '/editar') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['editar', incomeEditing.id.toString(), 'monto'] })

          await bot.sendMessage(msg.chat.id, `Escribe el nuevo monto para ${incomeEditing.source}:`)
          return
        }

        if (userText === '/eliminar') {
          await prisma.income.delete({
            where: {
              id: incomeEditing.id
            }
          })

          await chatUpdate(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Ingreso eliminado para ${incomeEditing.source}.`)
          return
        }
        break
    }
  }

  // Categoría
  if (userText === '/categoria') {
    await chatUpdate(msg.chat.id, { chatSubject: 'categoria', chatSubSubject: ['crear o ver'] })

    await bot.sendMessage(msg.chat.id, '¿Quieres crear una categoría o ver las categorías actuales?\n\n/crear\n\n/ver')
    return
  }

  if (chat.chatSubject === 'categoria') {
    switch (chat.chatSubSubject[0]) {
      case 'crear o ver':
        if (userText === '/crear') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['crear', 'descripcion'] })

          await bot.sendMessage(msg.chat.id, 'Escribe la descripción de la categoría:')
          return
        }
        if (userText === '/ver') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['ver'] })

          const categories = await prisma.category.findMany({
            orderBy: {
              description: 'asc'
            }
          })

          if (categories.length === 0) {
            await bot.sendMessage(msg.chat.id, 'No tienes categorías registradas.')
            return
          }

          const categoriesText = categories.map((cat, i) => {
            return `/${i + 1}. <b>${!!cat.fileUrl ? '📎 ' : ''}${cat.emoji} ${cat.description}</b>\nLimite: ${numeral(cat.limit).format('0,0.00')}${cat.currency}${cat.isFixed ? '\nGasto Fijo' : ''}${cat.notes ? `\n<blockquote>${cat.notes}</blockquote>` : ''}`
          }).join('\n\n')

          const incomes = await prisma.income.findMany({
            where: {
              statementId: chat.statement.id
            },
            orderBy: {
              createdAt: 'asc'
            }
          })

          const totalHNLIncomes = incomes.reduce((acc, income) => {
            if (income.currency === 'HNL') {
              return acc + income.amount
            }
            return acc + (income.amount * dollarToHNL)
          }, 0)

          const totalUSDIncomes = incomes.reduce((acc, income) => {
            if (income.currency === 'USD') {
              return acc + income.amount
            }
            return acc + (income.amount * hnlToDollar)
          }, 0)

          const totalHNLLimit = categories.reduce((acc, cat) => {
            if (cat.currency === 'HNL') {
              return acc + cat.limit
            }
            return acc + (cat.limit * dollarToHNL)
          }, 0)

          const totalUSDLimit = categories.reduce((acc, cat) => {
            if (cat.currency === 'USD') {
              return acc + cat.limit
            }
            return acc + (cat.limit * hnlToDollar)
          }, 0)

          const totalText = `${numeral(totalHNLLimit).format('0,0.00')} / ${numeral(totalHNLIncomes).format('0,0.00')} HNL\n${numeral(totalUSDLimit).format('0,0.00')} / ${numeral(totalUSDIncomes).format('0,0.00')} USD`

          await bot.sendMessage(msg.chat.id, `Presupuesto / Total:\n${totalText}`, { parse_mode: 'HTML' })

          await bot.sendMessage(msg.chat.id, `Presiona el /# para editar.\n\n${categoriesText}`, { parse_mode: 'HTML' })
          return
        }
        break
      case 'crear':
        switch (chat.chatSubSubject[1]) {
          case 'descripcion':
            // Ahorita nos esta contestando la descripcion de la categoria
            await chatUpdate(msg.chat.id, { chatSubSubject: ['crear', 'emoji'], chatHistory: [userText] })

            await bot.sendMessage(msg.chat.id, 'Manda un emoji:')
            return
          case 'emoji':
            await chatUpdate(msg.chat.id, { chatSubSubject: ['crear', 'fijo'], chatHistory: { push: userText } })

            await bot.sendMessage(msg.chat.id, '¿Es una gasto fijo?\n\n/si\n/no')
            return
          case 'fijo':
            await chatUpdate(msg.chat.id, { chatSubSubject: ['crear', 'nota'], chatHistory: { push: userText } })

            await bot.sendMessage(msg.chat.id, '¿Quieres agregar una nota?\n\n/no')
            return
          case 'nota':
            await chatUpdate(msg.chat.id, { chatSubSubject: ['crear', 'limite'], chatHistory: { push: userText.toLowerCase().trim() } })

            await bot.sendMessage(msg.chat.id, '¿Cuál es el límite de la categoría?')
            return
          case 'limite':
            const botLimitJSON = await AIAmountAndCurrency(userText)

            if ('error' in botLimitJSON) {
              await chatUpdate(msg.chat.id)
              await bot.sendMessage(msg.chat.id, botLimitJSON.error)
              return
            }

            const category = await prisma.category.create({
              data: {
                description: chat.chatHistory[0],
                emoji: chat.chatHistory[1],
                isFixed: chat.chatHistory[2] === '/si' ? true : false,
                notes: chat.chatHistory[3] === '/no' ? '' : chat.chatHistory[3],
                limit: botLimitJSON.amount,
                currency: botLimitJSON.currency,
                statementId: chat.statement.id
              }
            })

            await chatUpdate(msg.chat.id)

            await bot.sendMessage(msg.chat.id, `Categoría creada para ${category.emoji} ${category.description}.\n\n${numeral(category.limit).format('0,0.00')} ${category.currency}`)
            return
        }
        break
      case 'ver':
        if (userText.match(/^\/\d+$/)) {
          const index = parseInt(userText.replace('/', '')) - 1

          const categoryToEdit = await prisma.category.findMany({
            take: 1,
            skip: index,
            where: {
              statementId: chat.statement.id
            },
            orderBy: {
              description: 'asc'
            },
            include: {
              transactions: true
            }
          })

          if (categoryToEdit.length === 0) {
            await bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
            return
          }

          const categorySelected = categoryToEdit[0]

          await chatUpdate(msg.chat.id, { chatSubSubject: ['editar', `${categorySelected.id}`] })

          const spendHNL = categorySelected.transactions.reduce((acc, t) => {
            if (t.currency === 'HNL') {
              if (t.type === 'INCOME') {
                return acc - t.amount
              }
              return acc + t.amount
            }
            return acc
          }, 0)

          const spendUSD = categorySelected.transactions.reduce((acc, t) => {
            if (t.currency === 'USD') {
              if (t.type === 'INCOME') {
                return acc - t.amount
              }
              return acc + t.amount
            }
            return acc
          }, 0)

          const spendTotal = categorySelected.transactions.reduce((acc, t) => {
            if (categorySelected.currency === 'HNL') {
              if (t.type === 'INCOME') {
                if (t.currency === 'USD') return acc - (t.amount * dollarToHNL)
                return acc - t.amount
              }
              if (t.currency === 'USD') return acc + (t.amount * dollarToHNL)
              return acc + t.amount
            } else {
              if (t.type === 'INCOME') {
                if (t.currency === 'HNL') return acc - (t.amount * hnlToDollar)
                return acc - t.amount
              }
              if (t.currency === 'HNL') return acc + (t.amount * hnlToDollar)
              return acc + t.amount
            }
          }, 0)

          const spendText = `Gasto:\n${numeral(spendHNL).format('0,0.00')} HNL\n${numeral(spendUSD).format('0,0.00')} USD\n`
          const limitText = `Límite:\n${numeral(spendTotal).format('0,0.00')} / ${numeral(categorySelected.limit).format('0,0.00')} ${categorySelected.currency}${categorySelected.isFixed ? '\n<i>Gasto Fijo</i>' : ''}`
          const notesText = categorySelected.notes ? `\n\n<blockquote>${categorySelected.notes}</blockquote>` : ''

          const caption = `<b>${categorySelected.emoji} ${categorySelected.description}</b>\n\n${spendText}\n${limitText}${notesText}\n\n¿Qué quieres hacer?\n\n/editar limite\n\n${categorySelected.isFixed ? '/quitar de gasto fijos' : '/poner en gastos fijos'}\n\n/notas\n\n/adjuntar archivo\n\n/eliminar`

          if (categorySelected.fileUrl) {
            // get buffer
            const res = await fetch(categorySelected.fileUrl)

            if (!res.ok) {
              await bot.sendMessage(msg.chat.id, 'No se encontró el archivo adjunto.')
              return
            }
            const arrayBuffer = await res.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            if (categorySelected.fileType === 'PHOTO') {
              await bot.sendPhoto(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
            } else {
              await bot.sendDocument(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
            }
            return
          }

          await bot.sendMessage(msg.chat.id, caption, { parse_mode: 'HTML' })
          return
        }
        break
      case 'editar':
        const categoryEditing = await prisma.category.findUnique({
          where: {
            id: parseInt(chat.chatSubSubject[1]),
          }
        })

        if (!categoryEditing) {
          await bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
          return
        }

        if (userText === '/ver') {

        }

        if (userText === '/editar') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['editar', categoryEditing.id.toString(), 'limite'] })

          await bot.sendMessage(msg.chat.id, `Escribe el nuevo límite para ${categoryEditing.emoji} ${categoryEditing.description}:`)
          return
        }

        if (userText === '/notas') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['editar', categoryEditing.id.toString(), 'notas'] })

          await bot.sendMessage(msg.chat.id, `Escribe la nota para <b>${categoryEditing.emoji} ${categoryEditing.description}:</b> \n\n/quitar la nota.`, { parse_mode: 'HTML' })
          return
        }

        if (userText === '/eliminar') {
          await prisma.category.delete({
            where: {
              id: categoryEditing.id
            }
          })

          await chatUpdate(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Categoría eliminada ${categoryEditing.emoji} ${categoryEditing.description}.`)
          return
        }

        if (userText === '/adjuntar') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['editar', categoryEditing.id.toString(), 'adjuntar'] })

          await bot.sendMessage(msg.chat.id, `Envía el archivo que quieres adjuntar para <b>${categoryEditing.emoji} ${categoryEditing.description}.</b>${!!categoryEditing.fileUrl ? '\n\n/quitar el archivo adjunto' : ''}`, { parse_mode: 'HTML' })
          return
        }

        if (userText === '/quitar' && chat.chatSubSubject[2] === 'adjuntar') {
          await prisma.category.update({
            where: {
              id: categoryEditing.id
            },
            data: {
              fileUrl: null,
              fileType: null
            }
          })

          await chatUpdate(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Archivo eliminado para ${categoryEditing.emoji} ${categoryEditing.description}.`)
          return
        }

        if (userText === '/quitar' || userText === '/poner') {
          await prisma.category.update({
            where: {
              id: categoryEditing.id
            },
            data: {
              isFixed: userText === '/quitar' ? false : true
            }
          })

          await chatUpdate(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Gasto fijo ${userText === '/quitar' ? 'quitado' : 'agregado'} para ${categoryEditing.emoji} ${categoryEditing.description}.`)
          return
        }

        if (chat.chatSubSubject[2] === 'adjuntar') {
          if (!msg.photo && !msg.document) {
            await chatUpdate(msg.chat.id)
            await bot.sendMessage(msg.chat.id, 'Envía un archivo.\nEmpieza de nuevo.')
            return
          }

          const fileType: FileType = !!msg.photo ? 'PHOTO' : 'DOCUMENT'

          const photoLen = msg.photo?.length || 0
          // @ts-ignore
          const fileId = fileType === 'PHOTO' ? msg.photo[photoLen - 1].file_id : msg.document?.file_id

          if (!fileId) {
            await chatUpdate(msg.chat.id)
            await bot.sendMessage(msg.chat.id, 'No se encontró el archivo.\nEmpieza de nuevo.')
            return
          }

          await chatUpdate(msg.chat.id)

          const fileUrl = await bot.getFileLink(fileId)
          await prisma.category.update({
            where: {
              id: categoryEditing.id
            },
            data: {
              fileUrl: fileUrl,
              fileType: fileType
            }
          })

          await bot.sendMessage(msg.chat.id, `Archivo adjuntado para ${categoryEditing.emoji} ${categoryEditing.description}.`)
          return
        }

        if (chat.chatSubSubject[2] === 'limite') {
          const editJSON = await AIAmountAndCurrency(userText)

          if ('error' in editJSON) {
            await chatUpdate(msg.chat.id)
            await bot.sendMessage(msg.chat.id, editJSON.error)
            return
          }

          await prisma.category.update({
            where: {
              id: categoryEditing.id
            },
            data: {
              limit: editJSON.amount,
              currency: editJSON.currency
            }
          })

          await chatUpdate(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Límite actualizado para ${categoryEditing.emoji} ${categoryEditing.description}.\n\Limite: ${numeral(editJSON.amount).format('0,0.00')} ${editJSON.currency}`)
          return
        }

        if (chat.chatSubSubject[2] === 'notas') {
          if (userText === '/quitar') {
            await prisma.category.update({
              where: {
                id: categoryEditing.id
              },
              data: {
                notes: ''
              }
            })

            await chatUpdate(msg.chat.id)

            await bot.sendMessage(msg.chat.id, `Nota eliminada para ${categoryEditing.emoji} ${categoryEditing.description}.`)
            return
          }

          await prisma.category.update({
            where: {
              id: categoryEditing.id
            },
            data: {
              notes: userText
            }
          })

          await chatUpdate(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Nota actualizada para ${categoryEditing.emoji} ${categoryEditing.description}.\n\n${userText}`)
          return
        }
        break
    }
  }

  // Cambio
  if (userText === '/cambio') {
    await chatUpdate(msg.chat.id, { chatSubject: 'cambio', chatSubSubject: ['hnl o usd'] })

    await bot.sendMessage(msg.chat.id, '¿Quieres establecer el cambio de moneda actual?\n\n/hnl\n/usd')
    return
  }

  if (chat.chatSubject === 'cambio') {
    switch (chat.chatSubSubject[0]) {
      case 'hnl o usd':
        if (userText === '/hnl') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['hnl'] })

          await bot.sendMessage(msg.chat.id, '¿Cuántos dolares son un lempira?')
          return
        }
        if (userText === '/usd') {
          await chatUpdate(msg.chat.id, { chatSubSubject: ['usd'] })

          await bot.sendMessage(msg.chat.id, '¿Cuántos lempiras son un dolar?')
          return
        }
        break
      case 'hnl':
        const amountHNL = await AIAmount(userText)

        if ('error' in amountHNL) {
          await chatUpdate(msg.chat.id)
          await bot.sendMessage(msg.chat.id, amountHNL.error)
          return
        }

        await chatUpdate(msg.chat.id)

        await prisma.statement.update({
          where: {
            id: chat.statement.id
          },
          data: {
            hnlToDollar: amountHNL.amount
          }
        })

        await bot.sendMessage(msg.chat.id, `Cambio de moneda actualizado.\n\n1 HNL = ${amountHNL.amount} USD`)
        return
      case 'usd':
        const amountUSD = await AIAmount(userText)

        if ('error' in amountUSD) {
          await chatUpdate(msg.chat.id)
          await bot.sendMessage(msg.chat.id, amountUSD.error)
          return
        }

        await chatUpdate(msg.chat.id)

        await prisma.statement.update({
          where: {
            id: chat.statement.id
          },
          data: {
            dollarToHNL: amountUSD.amount
          }
        })

        await bot.sendMessage(msg.chat.id, `Cambio de moneda actualizado.\n\n1 USD = ${amountUSD.amount} HNL`)
        return
    }
  }

  const allCategories = await prisma.category.findMany({
    where: {
      statementId: chat.statement.id
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      transactions: userText === '/resumen' || chat.chatSubject === 'resumen'
    }
  })

  // resumen
  if (userText === '/resumen') {
    const categoriesText = allCategories.map((cat, i) => {
      const totalHNL = cat.transactions.reduce((acc, t) => {
        if (t.currency === 'HNL') {
          if (t.type === 'INCOME') {
            return acc - t.amount
          }
          return acc + t.amount
        }
        return acc
      }, 0)

      const totalUSD = cat.transactions.reduce((acc, t) => {
        if (t.currency === 'USD') {
          if (t.type === 'INCOME') {
            return acc - t.amount
          }
          return acc + t.amount
        }
        return acc
      }, 0)

      const totalSpend = cat.transactions.reduce((acc, t) => {
        if (cat.currency === 'HNL') {
          if (t.type === 'INCOME') {
            if (t.currency === 'USD') return acc - (t.amount * dollarToHNL)
            return acc - t.amount
          }
          if (t.currency === 'USD') return acc + (t.amount * dollarToHNL)
          return acc + t.amount
        } else {
          if (t.type === 'INCOME') {
            if (t.currency === 'HNL') return acc - (t.amount * hnlToDollar)
            return acc - t.amount
          }
          if (t.currency === 'HNL') return acc + (t.amount * hnlToDollar)
          return acc + t.amount
        }
      }, 0)

      return `<b>/${i + 1} ${cat.emoji} ${cat.description}</b>\n${numeral(totalHNL).format('0,0.00')} HNL\n${numeral(totalUSD).format('0,0.00')} USD\n${numeral(totalSpend).format('0,0.00')} / ${numeral(cat.limit).format('0,0.00')} ${cat.currency}${cat.notes ? `\n<blockquote>${cat.notes}</blockquote>` : ''}`
    }).join('\n\n')

    await chatUpdate(msg.chat.id, { chatSubject: 'resumen', chatSubSubject: [] })

    await bot.sendMessage(msg.chat.id, `Resumen de tu estado de cuenta actual:\n\n${categoriesText}`, { parse_mode: 'HTML' })
    return
  }

  if (chat.chatSubject === 'resumen') {
    if (userText.match(/^\/\d+$/)) {
      if (chat.chatSubSubject.length === 0) {
        const index = parseInt(userText.replace('/', '')) - 1
        const categorySelected = allCategories[index]

        if (!categorySelected) {
          await bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
          return
        }

        // Return all transactions
        const transactionsText = categorySelected.transactions.map((t, i) => {
          return `/${i + 1}. <b>${!!t.fileUrl ? '📎 ' : ''}${t.description}</b>\n${t.type === 'INCOME' ? 'Ingreso' : 'Gasto'} ${paymentMethod[t.paymentMethod]}\n${numeral(t.amount).format('0,0.00')} ${t.currency}${t.notes ? `\n<blockquote>${t.notes}</blockquote>` : ''}`
        }).join('\n\n')

        const totalHNL = categorySelected.transactions.reduce((acc, t) => {
          if (t.currency === 'HNL') {
            if (t.type === 'INCOME') {
              return acc - t.amount
            }
            return acc + t.amount
          }
          return acc
        }, 0)

        const totalUSD = categorySelected.transactions.reduce((acc, t) => {
          if (t.currency === 'USD') {
            if (t.type === 'INCOME') {
              return acc - t.amount
            }
            return acc + t.amount
          }
          return acc
        }, 0)

        const totalSpend = categorySelected.transactions.reduce((acc, t) => {
          if (categorySelected.currency === 'HNL') {
            if (t.type === 'INCOME') {
              if (t.currency === 'USD') return acc - (t.amount * dollarToHNL)
              return acc - t.amount
            }
            if (t.currency === 'USD') return acc + (t.amount * dollarToHNL)
            return acc + t.amount
          } else {
            if (t.type === 'INCOME') {
              if (t.currency === 'HNL') return acc - (t.amount * hnlToDollar)
              return acc - t.amount
            }
            if (t.currency === 'HNL') return acc + (t.amount * hnlToDollar)
            return acc + t.amount
          }
        }, 0)

        const totalsText = `<b>Totales:</b>\n${numeral(totalHNL).format('0,0.00')} HNL\n${numeral(totalUSD).format('0,0.00')} USD\n${numeral(totalSpend).format('0,0.00')} / ${numeral(categorySelected.limit).format('0,0.00')} ${categorySelected.currency}\n${categorySelected.notes ? `<blockquote>${categorySelected.notes}</blockquote>` : ''}`

        await chatUpdate(msg.chat.id, { chatSubject: 'resumen', chatSubSubject: [`${index}`] })
        await bot.sendMessage(msg.chat.id, `<b>${categorySelected.emoji} ${categorySelected.description}</b>\nPresiona el /# para editar.\n\n${transactionsText}\n\n${totalsText}`, { parse_mode: 'HTML' })
        return
      } else {
        const categorySelected = allCategories[parseInt(chat.chatSubSubject[0])]

        if (!categorySelected) {
          await bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
          return
        }

        const indexT = parseInt(userText.replace('/', '')) - 1
        const transactionSelected = categorySelected.transactions[indexT]

        if (!transactionSelected) {
          await bot.sendMessage(msg.chat.id, 'No se encontró la transacción.')
          return
        }
        await chatUpdate(msg.chat.id, { chatSubject: 'ultima', chatSubSubject: [`${transactionSelected.id}`] })

        const caption = `<i>${dayjs(transactionSelected.date).locale('es').format('dddd, MMMM D, YYYY h:mm A')}</i>\n<b>${!!transactionSelected.fileUrl ? '📎 ' : ''}${transactionSelected.description}</b>\n${categorySelected.emoji} ${categorySelected.description}\n${transactionSelected.type === 'INCOME' ? 'Ingreso' : 'Gasto'} ${paymentMethod[transactionSelected.paymentMethod]}\n${numeral(transactionSelected.amount).format('0,0.00')} ${transactionSelected.currency}${transactionSelected.notes ? `\n<blockquote>${transactionSelected.notes}<blockquote>` : ''}\n\n/adjuntar archivo\n\n/eliminar`

        if (!!transactionSelected.fileUrl) {
          // get buffer
          const res = await fetch(transactionSelected.fileUrl)

          if (!res.ok) {
            await bot.sendMessage(msg.chat.id, 'No se encontró el archivo adjunto.')
            return
          }
          const arrayBuffer = await res.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          if (transactionSelected.fileType === 'PHOTO') {
            await bot.sendPhoto(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
          } else {
            await bot.sendDocument(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
          }
          return
        }

        await bot.sendMessage(msg.chat.id, caption, { parse_mode: 'HTML' })
        return
      }
    }
  }

  // Ultima
  if (userText === '/ultima') {
    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        category: {
          statementId: chat.statement.id
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        category: true
      }
    })

    if (!lastTransaction) {
      await bot.sendMessage(msg.chat.id, 'No tienes transacciones registradas.')
      return
    }

    await chatUpdate(msg.chat.id, { chatSubject: 'ultima', chatSubSubject: [`${lastTransaction.id}`] })

    const caption = `<i>${dayjs(lastTransaction.date).locale('es').format('dddd, MMMM D, YYYY h:mm A')}</i>\n<b>${!!lastTransaction.fileUrl ? '📎 ' : ''}${lastTransaction.description}</b>\n${lastTransaction.category.emoji} ${lastTransaction.category.description}\n${lastTransaction.type === 'INCOME' ? 'Ingreso' : 'Gasto'} ${paymentMethod[lastTransaction.paymentMethod]}\n${numeral(lastTransaction.amount).format('0,0.00')} ${lastTransaction.currency}${lastTransaction.notes ? `\n<blockquote>${lastTransaction.notes}<blockquote>` : ''}\n\n/adjuntar archivo\n\n/eliminar`

    if (!!lastTransaction.fileUrl) {
      // get buffer
      const res = await fetch(lastTransaction.fileUrl)

      if (!res.ok) {
        await bot.sendMessage(msg.chat.id, 'No se encontró el archivo adjunto.')
        return
      }
      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (lastTransaction.fileType === 'PHOTO') {
        await bot.sendPhoto(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
      } else {
        await bot.sendDocument(msg.chat.id, buffer, { caption, parse_mode: 'HTML' })
      }
      return
    }

    await bot.sendMessage(msg.chat.id, caption, { parse_mode: 'HTML' })
    return
  }

  if (chat.chatSubject === 'ultima') {
    const lastTransaction = await prisma.transaction.findUnique({
      where: {
        id: parseInt(chat.chatSubSubject[0] || '0')
      }
    })

    if (!lastTransaction) {
      await bot.sendMessage(msg.chat.id, 'No se encontró la transacción.')
      return
    }

    if (userText === '/eliminar') {
      await prisma.transaction.delete({
        where: {
          id: lastTransaction.id
        }
      })

      await chatUpdate(msg.chat.id)
      await bot.sendMessage(msg.chat.id, 'Transacción eliminada.')
      return
    }

    if (userText === '/adjuntar') {
      await chatUpdate(msg.chat.id, { chatSubject: 'ultima', chatSubSubject: [`${lastTransaction.id}`, 'adjuntar'] })

      await bot.sendMessage(msg.chat.id, `Envía el archivo que quieres adjuntar para <b>${lastTransaction.description}.</b>${!!lastTransaction.fileUrl ? '\n\n/quitar el archivo adjunto' : ''}`, { parse_mode: 'HTML' })
      return
    }

    if (chat.chatSubSubject[1] === 'adjuntar' || userText === '/quitar') {
      if (userText === '/quitar') {
        await prisma.transaction.update({
          where: {
            id: lastTransaction.id
          },
          data: {
            fileUrl: null,
            fileType: null
          }
        })

        await chatUpdate(msg.chat.id)
        await bot.sendMessage(msg.chat.id, `Archivo eliminado para <b>${lastTransaction.description}.</b>`, { parse_mode: 'HTML' })
        return
      }

      if (!msg.photo && !msg.document) {
        await chatUpdate(msg.chat.id)
        await bot.sendMessage(msg.chat.id, 'Envía un archivo.\nEmpieza de nuevo.')
        return
      }

      const fileType: FileType = !!msg.photo ? 'PHOTO' : 'DOCUMENT'

      const photoLen = msg.photo?.length || 0
      // @ts-ignore
      const fileId = fileType === 'PHOTO' ? msg.photo[photoLen - 1].file_id : msg.document.file_id
      if (!fileId) {
        await chatUpdate(msg.chat.id)
        await bot.sendMessage(msg.chat.id, 'No se encontró el archivo.\nEmpieza de nuevo.')
        return
      }

      await chatUpdate(msg.chat.id)

      const fileUrl = await bot.getFileLink(fileId)
      await prisma.transaction.update({
        where: {
          id: lastTransaction.id
        },
        data: {
          fileUrl: fileUrl,
          fileType: fileType
        }
      })

      await bot.sendMessage(msg.chat.id, `Archivo adjuntado para <b>${lastTransaction.description}.</b>`, { parse_mode: 'HTML' })
      return
    }
  }

  // Fijos
  if (userText === '/fijos') {
    // Get all fixed categories
    const fixedCategories = await prisma.category.findMany({
      where: {
        statementId: chat.statement.id,
        isFixed: true
      },
      include: {
        transactions: true
      },
      orderBy: {
        description: 'asc'
      }
    })

    if (fixedCategories.length === 0) {
      await bot.sendMessage(msg.chat.id, 'No tienes gastos fijos registrados.')
      return
    }

    const fixedText = fixedCategories.map((cat, i) => {
      const totalHNL = cat.transactions.reduce((acc, t) => {
        if (t.currency === 'HNL') {
          if (t.type === 'INCOME') {
            return acc - t.amount
          }
          return acc + t.amount
        }
        return acc
      }, 0)

      const totalUSD = cat.transactions.reduce((acc, t) => {
        if (t.currency === 'USD') {
          if (t.type === 'INCOME') {
            return acc - t.amount
          }
          return acc + t.amount
        }
        return acc
      }, 0)

      const totalSpend = cat.transactions.reduce((acc, t) => {
        if (cat.currency === 'HNL') {
          if (t.type === 'INCOME') {
            if (t.currency === 'USD') return acc - (t.amount * dollarToHNL)
            return acc - t.amount
          }
          if (t.currency === 'USD') return acc + (t.amount * dollarToHNL)
          return acc + t.amount
        } else {
          if (t.type === 'INCOME') {
            if (t.currency === 'HNL') return acc - (t.amount * hnlToDollar)
            return acc - t.amount
          }
          if (t.currency === 'HNL') return acc + (t.amount * hnlToDollar)
          return acc + t.amount
        }
      }, 0)

      return {
        text: `/${i + 1}. <b>${cat.emoji} ${cat.description}</b>\n${numeral(totalHNL).format('0,0.00')} HNL\n${numeral(totalUSD).format('0,0.00')} USD\n${numeral(totalSpend).format('0,0.00')} / ${numeral(cat.limit).format('0,0.00')} ${cat.currency}\n${cat.isPaid ? '✅ Pagado' : '❌ No se ha pagado'}${cat.notes ? `\n<blockquote>${cat.notes}</blockquote>` : ''}`,
        isPaid: cat.isPaid,
      }
    }).sort((a, b) => a.isPaid === b.isPaid ? 0 : a.isPaid ? 1 : -1)

    await chatUpdate(msg.chat.id, { chatSubject: 'fijos', chatSubSubject: [] })
    await bot.sendMessage(msg.chat.id, `<i>Presiona /# para marcar como pagado</i>\nGastos fijos:\n\n${fixedText.map(f => f.text).join('\n\n')}`, { parse_mode: 'HTML' })
    return
  }

  if (chat.chatSubject === 'fijos') {
    if (userText.match(/^\/\d+$/)) {
      const index = parseInt(userText.replace('/', '')) - 1

      const fixedSelected = await prisma.category.findFirst({
        where: {
          statementId: chat.statement.id,
          isFixed: true
        },
        skip: index,
        orderBy: {
          description: 'asc'
        },
        include: {
          transactions: true
        }
      })

      if (!fixedSelected) {
        await bot.sendMessage(msg.chat.id, 'No se encontró el gasto fijo.')
        return
      }

      const fixedUpdate = await prisma.category.update({
        where: {
          id: fixedSelected.id
        },
        data: {
          isPaid: !fixedSelected.isPaid
        }
      })

      await chatUpdate(msg.chat.id)
      await bot.sendMessage(msg.chat.id, `Gasto fijo para ${fixedSelected.emoji} ${fixedSelected.description}\n${fixedUpdate.isPaid ? '✅ Pagado' : '❌ No pagado'}.`)
      return
    }
  }

  // Add transaction
  const history: ChatCompletionMessageParam[] = chat.chatHistory.map((h, i) => {
    return {
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: h
    }
  })

  const botTransactionJSON = await AITransaction(allCategories, userText, history)

  if ('reset' in botTransactionJSON) {
    await chatUpdate(msg.chat.id)
    await bot.sendMessage(msg.chat.id, 'Intenta de nuevo.')
    return
  }

  if ('error' in botTransactionJSON) {
    await chatUpdate(msg.chat.id, {
      chatHistory: {
        push: [
          userText,
          botTransactionJSON.error,
        ]
      }
    })
    await bot.sendMessage(msg.chat.id, botTransactionJSON.error)
    return
  }


  await chatUpdate(msg.chat.id)

  try {
    const saveCategory = allCategories.find(c => c.description === botTransactionJSON.category)
    if (!saveCategory) {
      bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
      return
    }

    const newTransaction = await prisma.transaction.create({
      data: {
        date: dayjs(botTransactionJSON.date).format(),
        description: botTransactionJSON.description,
        categoryId: saveCategory.id,
        paymentMethod: botTransactionJSON.paymentMethod,
        type: botTransactionJSON.type,
        amount: botTransactionJSON.amount,
        currency: botTransactionJSON.currency,
        notes: botTransactionJSON.notes || ''
      },
      include: {
        category: true
      }
    })

    await chatUpdate(msg.chat.id, { chatSubject: 'ultima', chatSubSubject: [`${newTransaction.id}`] })

    await bot.sendMessage(msg.chat.id, `<i>Transacción creada.</i>\n\n<i>${dayjs(newTransaction.date).locale('es').format('dddd, MMMM D, YYYY h:mm A')}</i>\n<b>${newTransaction.description}</b>\n${newTransaction.category.emoji} ${newTransaction.category.description}\n${newTransaction.type === 'INCOME' ? 'Ingreso' : 'Gasto'} ${paymentMethod[newTransaction.paymentMethod]}\n${numeral(newTransaction.amount).format('0,0.00')} ${newTransaction.currency}${newTransaction.notes ? `\n<blockquote>${newTransaction.notes}<blockquote>` : ''}\n\n/adjuntar archivo`, { parse_mode: 'HTML' })
    return
  } catch (error) {
    console.error(error)
    bot.sendMessage(msg.chat.id, 'No se pudo crear la transacción.')
    return
  }
})

async function chatUpdate(chatId: number, data: Prisma.ChatUncheckedUpdateInput = { chatHistory: [], chatSubject: '', chatSubSubject: [] }) {
  await prisma.chat.update({
    where: {
      chatId: chatId
    },
    data: data
  })
}