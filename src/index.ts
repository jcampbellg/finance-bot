import TelegramBot from 'node-telegram-bot-api'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import numeral from 'numeral'
import * as dotenv from 'dotenv'
import prisma from '@utils/prisma'
import { AIAmountAndCurrency, AISaveIncome, AIStatement } from '@utils/AI'
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

bot.on('message', async (msg) => {
  if (!userWhitelist.includes(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, `You, ${msg.chat.id} are not authorized to use this bot.`)
    return
  }

  if (!msg.text && !msg.voice) {
    bot.sendMessage(msg.chat.id, 'Envia un mensaje de texto o de voz.')
    return
  }

  bot.sendChatAction(msg.chat.id, 'typing')
  const conversion = await prisma.conversion.findFirst({
    orderBy: {
      createdAt: 'asc'
    }
  })
  const dollarToHNL = conversion?.dollarToHNL || 24.6
  const hnlToDollar = conversion?.hnlToDollar || 0.04

  if (msg.text === '/start') {
    await bot.setMyCommands([{
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
    }], {
      scope: {
        type: msg.chat.type === 'group' ? 'all_group_chats' : 'chat',
        chat_id: msg.chat.id
      },
      language_code: 'en'
    })

    await bot.getMyCommands({ type: 'chat', chat_id: msg.chat.id }, 'en')

    const userExists = await prisma.user.findUnique({
      where: {
        chatId: msg.chat.id
      }
    })

    if (!!userExists) {
      await bot.sendMessage(msg.chat.id, 'Ya tienes una cuenta creada.')
      return
    }

    await prisma.user.create({
      data: {
        fullName: msg.chat.first_name || msg.chat.username || '',
        chatId: msg.chat.id,
        chatSubject: '',
        chatSubSubject: [],
        chatHistory: []
      }
    })

    await bot.sendMessage(msg.chat.id, 'Empezemos con /estado para crear un estado de cuenta mensual.')
    return
  }

  const user = await prisma.user.findUnique({
    where: {
      chatId: msg.chat.id
    },
    include: {
      statement: true
    }
  })

  if (!user) {
    await bot.sendMessage(msg.chat.id, 'Primero debes iniciar el bot con el comando /start.')
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
    userChat(msg.chat.id, { chatSubject: 'estado', chatSubSubject: [!!user.statement ? 'queres cambiarlo' : 'mes y año'] })

    if (!!user.statement) {
      const monthInSpanish = dayjs().locale('es').month(user.statement.month - 1).format('MMMM')
      const year = user.statement.year
      await bot.sendMessage(msg.chat.id, `Tu estado de cuenta actual es para el mes de ${monthInSpanish} del año ${year}.\n\n¿Quieres cambiarlo?\n/si\n/no`)
      return
    }

    await bot.sendMessage(msg.chat.id, 'No tienes estado de cuenta. Escribe el mes y año para el estado de cuenta:')
    return
  }

  if (user.chatSubject === 'estado') {
    switch (user.chatSubSubject[0]) {
      case 'mes y año':
        const botMessageJSON = await AIStatement(userText)

        if ('error' in botMessageJSON) {
          userChat(msg.chat.id)
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
          await bot.sendMessage(msg.chat.id, `Cambiando el estado de cuenta para el mes de ${monthInSpanish} del año ${year}.`)
          return
        }

        const newStatement = await prisma.statement.create({
          data: {
            month,
            year
          }
        })

        if (user.statement) {
          const oldCategories = await prisma.category.findMany({
            where: {
              statementId: user.statement.id
            }
          })

          const oldIncomes = await prisma.income.findMany({
            where: {
              statementId: user.statement.id
            }
          })

          await prisma.statement.update({
            where: {
              id: newStatement.id
            },
            data: {
              // todo
              categories: oldCategories.map(c => { })
            }
          })
        }

        userChat(msg.chat.id, { statementId: newStatement.id, chatSubject: '', chatSubSubject: [], chatHistory: [] })

        await bot.sendMessage(msg.chat.id, `Estado de cuenta creado para el mes de ${monthInSpanish} del año ${year}.`)
        return
      case 'queres cambiarlo':
        if (userText === '/si') {
          userChat(msg.chat.id, { chatSubSubject: ['mes y año'] })

          await bot.sendMessage(msg.chat.id, 'Escribe el mes y año para el estado de cuenta:')
          return
        }

        if (userText === '/no') {
          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, 'Entendido.')
          return
        }
        break
    }
  }

  if (!user.statement) {
    await bot.sendMessage(msg.chat.id, 'Primero debes crear un estado de cuenta con el comando /estado.')
    return
  }

  // Ingreso
  if (userText === '/ingreso') {
    userChat(msg.chat.id, { chatSubject: 'ingreso', chatSubSubject: ['crear o ver'] })

    await bot.sendMessage(msg.chat.id, '¿Quieres crear un ingreso o ver los ingresos actuales?\n\n/crear\n/ver')
    return
  }

  if (user.chatSubject === 'ingreso') {
    switch (user.chatSubSubject[0]) {
      case 'crear o ver':
        if (userText === '/crear') {
          userChat(msg.chat.id, { chatSubSubject: ['crear', 'fuente'] })

          await bot.sendMessage(msg.chat.id, '¿Cuál es la fuente de tu ingreso?')
          return
        }
        if (userText === '/ver') {
          userChat(msg.chat.id, { chatSubSubject: ['ver'] })

          const incomes = await prisma.income.findMany({
            where: {
              statementId: user.statement.id
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
        switch (user.chatSubSubject[1]) {
          case 'fuente':
            // Ahorita nos esta contestando la fuente del ingreso
            userChat(msg.chat.id, { chatSubSubject: ['crear', 'monto'], chatHistory: [userText] })

            await bot.sendMessage(msg.chat.id, '¿Cuánto es el ingreso?')
            return
          case 'monto':
            const botMessageJSON = await AISaveIncome(user.chatHistory[0], userText)

            if ('error' in botMessageJSON) {
              userChat(msg.chat.id)
              await bot.sendMessage(msg.chat.id, botMessageJSON.error)
              return
            }

            const income = await prisma.income.create({
              data: {
                source: botMessageJSON.source,
                currency: botMessageJSON.currency,
                amount: botMessageJSON.amount,
                statementId: user.statement.id
              }
            })

            userChat(msg.chat.id)

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
              statementId: user.statement.id
            },
            orderBy: {
              createdAt: 'asc'
            }
          })

          if (incomeToEdit.length === 0) {
            await bot.sendMessage(msg.chat.id, 'No se encontró el ingreso.')
            return
          }

          userChat(msg.chat.id, { chatSubSubject: ['editar', `${incomeToEdit[0].id}`] })

          await bot.sendMessage(msg.chat.id, `<b>${incomeToEdit[0].source}</b>\n${numeral(incomeToEdit[0].amount).format('0,0.00')} ${incomeToEdit[0].currency}\n\n¿Qué quieres hacer?\n\n/editar monto\n/eliminar`, { parse_mode: 'HTML' })
          return
        }
        break
      case 'editar':
        const incomeEditing = await prisma.income.findUnique({
          where: {
            id: parseInt(user.chatSubSubject[1]),
          }
        })

        if (!incomeEditing) {
          await bot.sendMessage(msg.chat.id, 'No se encontró el ingreso.')
          return
        }

        if (user.chatSubSubject[2] === 'monto') {
          const editJSON = await AIAmountAndCurrency(userText)

          if ('error' in editJSON) {
            userChat(msg.chat.id)
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

          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Monto actualizado para ${incomeEditing.source}.\n\n${numeral(editJSON.amount).format('0,0.00')} ${incomeEditing.currency}`)
          return
        }

        if (userText === '/editar') {
          userChat(msg.chat.id, { chatSubSubject: ['editar', incomeEditing.id.toString(), 'monto'] })

          await bot.sendMessage(msg.chat.id, `Escribe el nuevo monto para ${incomeEditing.source}:`)
          return
        }

        if (userText === '/eliminar') {
          await prisma.income.delete({
            where: {
              id: incomeEditing.id
            }
          })

          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Ingreso eliminado para ${incomeEditing.source}.`)
          return
        }
        break
    }
  }

  // Categoría
  if (userText === '/categoria') {
    userChat(msg.chat.id, { chatSubject: 'categoria', chatSubSubject: ['crear o ver'] })

    await bot.sendMessage(msg.chat.id, '¿Quieres crear una categoría o ver las categorías actuales?\n\n/crear\n/ver')
    return
  }

  if (user.chatSubject === 'categoria') {
    switch (user.chatSubSubject[0]) {
      case 'crear o ver':
        if (userText === '/crear') {
          userChat(msg.chat.id, { chatSubSubject: ['crear', 'descripcion'] })

          await bot.sendMessage(msg.chat.id, 'Escribe la descripción de la categoría:')
          return
        }
        if (userText === '/ver') {
          userChat(msg.chat.id, { chatSubSubject: ['ver'] })

          const budgetCategories = await prisma.category.findMany({
            orderBy: {
              description: 'asc'
            }
          })

          if (budgetCategories.length === 0) {
            await bot.sendMessage(msg.chat.id, 'No tienes categorías registradas.')
            return
          }

          const categoriesText = budgetCategories.map((cat, i) => {
            return `/${i + 1}. <b>${cat.emoji} ${cat.description}</b>\nLimite: ${numeral(cat.limit).format('0,0.00')} ${cat.currency}${cat.isFixed ? '\nGasto Fijo' : ''}`
          }).join('\n\n')

          await bot.sendMessage(msg.chat.id, `Presiona el /# para editar.\n\n${categoriesText}`, { parse_mode: 'HTML' })
          return
        }
        break
      case 'crear':
        switch (user.chatSubSubject[1]) {
          case 'descripcion':
            // Ahorita nos esta contestando la descripcion de la categoria
            userChat(msg.chat.id, { chatSubSubject: ['crear', 'emoji'], chatHistory: [userText] })

            await bot.sendMessage(msg.chat.id, 'Manda un emoji:')
            return
          case 'emoji':
            userChat(msg.chat.id, { chatSubSubject: ['crear', 'fijo'], chatHistory: [user.chatHistory[0], userText] })

            await bot.sendMessage(msg.chat.id, '¿Es una gasto fijo?\n\n/si\n/no')
            return
          case 'fijo':
            userChat(msg.chat.id, { chatSubSubject: ['crear', 'limite'], chatHistory: [user.chatHistory[0], user.chatHistory[1], userText] })

            await bot.sendMessage(msg.chat.id, '¿Cuál es el límite de la categoría?')
            return
          case 'limite':
            const botLimitJSON = await AIAmountAndCurrency(userText)

            if ('error' in botLimitJSON) {
              userChat(msg.chat.id)
              await bot.sendMessage(msg.chat.id, botLimitJSON.error)
              return
            }

            const category = await prisma.category.create({
              data: {
                description: user.chatHistory[0],
                emoji: user.chatHistory[1],
                isFixed: user.chatHistory[2] === '/si' ? true : false,
                limit: botLimitJSON.amount,
                currency: botLimitJSON.currency,
                statementId: user.statement.id
              }
            })

            userChat(msg.chat.id)

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
              statementId: user.statement.id
            },
            orderBy: {
              description: 'asc'
            }
          })

          if (categoryToEdit.length === 0) {
            await bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
            return
          }

          const categorySelected = categoryToEdit[0]

          userChat(msg.chat.id, { chatSubSubject: ['editar', `${categorySelected.id}`] })

          const limitText = `Límite: ${numeral(categorySelected.limit).format('0,0.00')} ${categorySelected.currency}${categorySelected.isFixed ? '\nGasto Fijo' : ''}`

          await bot.sendMessage(msg.chat.id, `<b>${categorySelected.emoji} ${categorySelected.description}</b>\n${limitText}\n\n¿Qué quieres hacer?\n\n/editar limite\n/eliminar\n${categorySelected.isFixed ? '/quitar de gasto fijos' : '/poner en gastos fijos'}`, { parse_mode: 'HTML' })
          return
        }
        break
      case 'editar':
        const categoryEditing = await prisma.category.findUnique({
          where: {
            id: parseInt(user.chatSubSubject[1]),
          }
        })

        if (!categoryEditing) {
          await bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
          return
        }

        if (userText === '/editar') {
          userChat(msg.chat.id, { chatSubSubject: ['editar', categoryEditing.id.toString(), 'limite'] })

          await bot.sendMessage(msg.chat.id, `Escribe el nuevo límite para ${categoryEditing.emoji} ${categoryEditing.description}:`)
          return
        }

        if (userText === '/eliminar') {
          await prisma.category.delete({
            where: {
              id: categoryEditing.id
            }
          })

          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Categoría eliminada ${categoryEditing.emoji} ${categoryEditing.description}.`)
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

          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Gasto fijo ${userText === '/quitar' ? 'quitado' : 'agregado'} para ${categoryEditing.emoji} ${categoryEditing.description}.`)
          return
        }

        if (user.chatSubSubject[2] === 'limite') {
          const editJSON = await AIAmountAndCurrency(userText)

          if ('error' in editJSON) {
            userChat(msg.chat.id)
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

          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Límite actualizado para ${categoryEditing.emoji} ${categoryEditing.description}.\n\Limite: ${numeral(editJSON.amount).format('0,0.00')} ${editJSON.currency}`)
          return
        }
        break
    }
  }

  await bot.sendMessage(msg.chat.id, 'No entiendo tu mensaje. Empieza otra vez.')
  userChat(msg.chat.id)
  return
})

type ChatData = {
  chatSubject?: string
  chatSubSubject?: string[]
  chatHistory?: string[]
  statementId?: number
}

async function userChat(chatId: number, data: ChatData = { chatHistory: [], chatSubject: '', chatSubSubject: [] }) {
  await prisma.user.update({
    where: {
      chatId: chatId
    },
    data: data
  })
}