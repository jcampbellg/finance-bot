import TelegramBot from 'node-telegram-bot-api'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import numeral from 'numeral'
import * as dotenv from 'dotenv'
import prisma from '@utils/prisma'
import { AIEditIncome, AISaveIncome, AIStatement } from '@utils/AI'
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

          const incomes = await prisma.budgetIncome.findMany({
            where: {
              statementId: user.statement.id
            },
            include: {
              income: true
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
            return `/${i + 1}. <b>${income.income.source}</b>\n${income.amount} ${income.income.currency}`
          }).join('\n\n')

          const totalInUSD = incomes.reduce((acc, income) => {
            if (income.income.currency === 'HNL') {
              return acc + (income.amount * hnlToDollar)
            }
            return acc + income.amount
          }, 0)

          const totalInHNL = incomes.reduce((acc, income) => {
            if (income.income.currency === 'USD') {
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
                budgetIncome: {
                  create: {
                    amount: botMessageJSON.amount,
                    statementId: user.statement.id
                  }
                }
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

          const budgetIncomes = await prisma.budgetIncome.findMany({
            take: 1,
            skip: index,
            where: {
              statementId: user.statement.id
            },
            include: {
              income: true
            },
            orderBy: {
              createdAt: 'asc'
            }
          })

          if (budgetIncomes.length === 0) {
            await bot.sendMessage(msg.chat.id, 'No se encontró el ingreso.')
            return
          }

          userChat(msg.chat.id, { chatSubSubject: ['editar', `${budgetIncomes[0].id}`] })

          await bot.sendMessage(msg.chat.id, `<b>${budgetIncomes[0].income.source}</b>\n${numeral(budgetIncomes[0].amount).format('0,0.00')} ${budgetIncomes[0].income.currency}\n\n¿Qué quieres hacer?\n\n/editar monto\n/eliminar`, { parse_mode: 'HTML' })
          return
        }
        break
      case 'editar':
        const budgetIncome = await prisma.budgetIncome.findUnique({
          where: {
            id: parseInt(user.chatSubSubject[1]),
          },
          include: {
            income: true
          }
        })

        if (!budgetIncome) {
          await bot.sendMessage(msg.chat.id, 'No se encontró el ingreso.')
          return
        }

        if (user.chatSubSubject[2] === 'monto') {
          const editJSON = await AIEditIncome(userText)

          if ('error' in editJSON) {
            userChat(msg.chat.id)
            await bot.sendMessage(msg.chat.id, editJSON.error)
            return
          }

          await prisma.budgetIncome.update({
            where: {
              id: budgetIncome.id
            },
            data: {
              amount: editJSON.amount,
            }
          })

          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Monto actualizado para ${budgetIncome.income.source}.\n\n${numeral(editJSON.amount).format('0,0.00')} ${budgetIncome.income.currency}`)
          return
        }

        if (userText === '/editar') {
          userChat(msg.chat.id, { chatSubSubject: ['editar', budgetIncome.id.toString(), 'monto'] })

          await bot.sendMessage(msg.chat.id, `Escribe el nuevo monto para ${budgetIncome.income.source}:`)
          return
        }

        if (userText === '/eliminar') {
          await prisma.budgetIncome.delete({
            where: {
              id: budgetIncome.id
            }
          })

          userChat(msg.chat.id)

          await bot.sendMessage(msg.chat.id, `Ingreso eliminado para ${budgetIncome.income.source}.`)
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