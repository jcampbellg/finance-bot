import TelegramBot from 'node-telegram-bot-api'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import numeral from 'numeral'
import * as dotenv from 'dotenv'
import prisma from '@utils/prisma'
import { Income } from '@prisma/client'
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

if (process.env.DOLLAR_TO_HNL === undefined) {
  throw new Error('DOLLAR_TO_HNL is not defined')
}

if (process.env.HNL_TO_DOLLAR === undefined) {
  throw new Error('HNL_TO_DOLLAR is not defined')
}

const dollarToHNL = parseFloat(process.env.DOLLAR_TO_HNL)
const hnlToDollar = parseFloat(process.env.HNL_TO_DOLLAR)

dayjs.extend(utc)
dayjs.extend(timezone)

const userWhitelist: number[] = JSON.parse(process.env.userWhitelist)

const token = process.env.botToken

const bot = new TelegramBot(token, { polling: true })

bot.on('message', async (msg) => {
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')
  if (!userWhitelist.includes(msg.chat.id)) {
    bot.sendMessage(msg.chat.id, `You, ${msg.chat.id} are not authorized to use this bot.`)
    return
  }

  if (!msg.text && !msg.voice) {
    bot.sendMessage(msg.chat.id, 'Envia un mensaje de texto o de voz.')
    return
  }

  if (msg.text === '/start') {
    bot.sendChatAction(msg.chat.id, 'typing')
    await bot.setMyCommands([{
      command: 'estado',
      description: 'Crear o edita tus estados de cuentas mensuales.'
    }, {
      command: 'ingreso',
      description: 'Crear o edita tus ingresos mensuales.'
    }, {
      command: 'categoria',
      description: 'Crear o edita tus categorías de gastos.'
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
        chatId: msg.chat.id,
        chatSubject: '',
        chatSubSubject: '',
        chatHistory: []
      }
    })

    await bot.sendMessage(msg.chat.id, 'Empezemos con /estado para crear un estado de cuenta mensual.')
    return
  }

  const user = await prisma.user.findUnique({
    where: {
      chatId: msg.chat.id
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

  const chatHistory = user.chatHistory.map(s => {
    const json = JSON.parse(s)
    return {
      role: json.role as 'assistant' | 'user',
      content: json.content as string
    }
  }) || []

  if (userText === '/No') {
    bot.sendChatAction(msg.chat.id, 'typing')
    // Reset chat
    await prisma.user.update({
      where: {
        chatId: msg.chat.id
      },
      data: {
        chatHistory: [],
        chatSubject: '',
        chatSubSubject: ''
      }
    })
    await bot.sendMessage(msg.chat.id, 'Entendido. ¿En qué más puedo ayudarte?')
  }

  if (userText === '/ingreso') {
    bot.sendChatAction(msg.chat.id, 'typing')

    if (!user.statementIdSet) {
      await bot.sendMessage(msg.chat.id, 'Primero debes crear un estado de cuenta.\nUsa /estado para crear uno.')
      return
    }

    await prisma.user.update({
      where: {
        chatId: msg.chat.id
      },
      data: {
        chatSubject: 'income',
        chatSubSubject: 'ask',
        chatHistory: []
      }
    })
    await bot.sendMessage(msg.chat.id, '¿Que deseas hacer?\n/crear un ingreso\n/ver tus ingresos')
    return
  }

  if (user.chatSubject === 'income') {
    bot.sendChatAction(msg.chat.id, 'typing')

    if (user.chatSubSubject === 'view') {
      if (userText.startsWith('/')) {
        try {
          const index = parseInt(userText.replace('/', '')) - 1
          const incomes = await prisma.income.findMany()

          await prisma.income.delete({
            where: {
              id: incomes[index].id
            }
          })
          await bot.sendMessage(msg.chat.id, 'Ingreso eliminado correctamente.')
        } catch (error) {
          await bot.sendMessage(msg.chat.id, 'No se pudo eliminar el ingreso. Inténtalo de nuevo.')
        }

        prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatHistory: [],
            chatSubject: '',
            chatSubSubject: ''
          }
        })
      }
    }

    if (user.chatSubSubject === 'ask') {
      if (userText === '/crear') {
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatSubSubject: 'create',
            chatHistory: []
          }
        })
        await bot.sendMessage(msg.chat.id, '¿Cuál es tu ingreso mensual, su moneda y de donde proviene?')
        return
      }

      if (userText === '/ver') {
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatSubSubject: 'view',
            chatHistory: []
          }
        })
        const incomes = await prisma.income.findMany()

        if (incomes.length === 0) {
          await bot.sendMessage(msg.chat.id, 'No tienes ingresos registrados.')
          return
        }

        const incomesText = incomes.map((income: Income, i) => {
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

        await bot.sendMessage(msg.chat.id, `Presiona el /# para eliminar.\n\n${incomesText}\n\nTotal HNL: ${numeral(totalInHNL).format('0,0.00')}\nTotal USD: ${numeral(totalInUSD).format('0,0.00')}`, { parse_mode: 'HTML' })
        return
      }
    }

    if (user.chatSubSubject === 'create') {
      if (userText === '/Si') {
        const newData = JSON.parse(chatHistory[chatHistory.length - 1].content)

        await prisma.income.create({
          data: {
            // @ts-ignore
            statementId: user.statementIdSet,
            // @ts-ignore
            amount: parseFloat(newData.amount),
            // @ts-ignore
            currency: newData.currency,
            // @ts-ignore
            source: newData.source,
          }
        })

        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatHistory: [],
            chatSubject: '',
            chatSubSubject: ''
          }
        })

        await bot.sendMessage(msg.chat.id, 'Ingreso creado correctamente.')
        return
      }

      const botAI = await openAi.chat.completions.create({
        messages: [{
          role: 'system',
          content: `Today is: ${today}`
        }, {
          role: 'system',
          content: 'Reply in spanish'
        }, {
          role: 'system',
          content: `Your job is to get amount, currency and source of your income from the user.`
        }, {
          role: 'system',
          content: `The currency can be HNL (the user can type L, Lempiras or HNL) or USD (the user can type as $ or Dollars).`
        }, {
          role: 'system',
          content: 'You will return these data in JSON format: { "amount": <amount in number>, "currency": "HNL" or "USD", "source": <job description> } or { "error": "error message" }'
        }, ...chatHistory, {
          role: 'user',
          content: userText
        }],
        model: 'gpt-4-1106-preview',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300
      })

      const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
      const botMessageJSON = JSON.parse(botMessage)

      if ('reset' in botMessageJSON) {
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatHistory: []
          }
        })

        await bot.sendMessage(msg.chat.id, 'No se pudo procesar la información. Inténtalo de nuevo.')
        return
      }

      if ('error' in botMessageJSON) {
        await bot.sendMessage(msg.chat.id, botMessageJSON.error)
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatHistory: {
              push: [
                JSON.stringify({ role: 'user', content: userText }),
                JSON.stringify({ role: 'assistant', content: botMessageJSON.error })
              ]
            }
          }
        })
        return
      }

      await bot.sendMessage(msg.chat.id, botMessage)
      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          chatHistory: {
            push: [
              JSON.stringify({ role: 'user', content: userText }),
              JSON.stringify({ role: 'assistant', content: botMessage })
            ]
          }
        }
      })
      await bot.sendMessage(msg.chat.id, "¿Estás de acuerdo con estos datos?\n/Si\n/No")
    }
  }

  if (userText === '/estado') {
    bot.sendChatAction(msg.chat.id, 'typing')
    await prisma.user.update({
      where: {
        chatId: msg.chat.id
      },
      data: {
        chatSubject: 'statement',
        chatSubSubject: 'ask',
        chatHistory: []
      }
    })

    if (user.statementIdSet) {
      const statement = await prisma.statement.findUnique({
        where: {
          id: user.statementIdSet
        }
      })

      if (!!statement) {

        const monthInSpanish = dayjs().locale('es').month(statement?.month - 1).format('MMMM')
        const year = statement?.year

        await bot.sendMessage(msg.chat.id, `Estado de cuenta actual: ${monthInSpanish} ${year}`)
      }
    }

    await bot.sendMessage(msg.chat.id, '¿Qué mes y año deseas?\nEjemplo: Enero 2022')
    return
  }

  if (user.chatSubject === 'statement') {
    if (user.chatSubSubject === 'ask') {
      const botAI = await openAi.chat.completions.create({
        messages: [{
          role: 'system',
          content: `Today is: ${today}`
        }, {
          role: 'system',
          content: 'Reply in spanish'
        }, {
          role: 'system',
          content: `Your job is to get the month and year from the user. The user can type the month in full or in short form.`
        }, {
          role: 'system',
          content: 'You will return these data in JSON format: { "month": <from 1 to 12>, "year": <4 digits number> } or { "error": "error message" }'
        }, ...chatHistory, {
          role: 'user',
          content: userText
        }],
        model: 'gpt-4-1106-preview',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300
      })

      const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
      const botMessageJSON = JSON.parse(botMessage)

      if ('reset' in botMessageJSON) {
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatHistory: []
          }
        })

        await bot.sendMessage(msg.chat.id, 'No se pudo procesar la información. Inténtalo de nuevo.')
        return
      }

      if ('error' in botMessageJSON) {
        await bot.sendMessage(msg.chat.id, botMessageJSON.error)
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatHistory: {
              push: [
                JSON.stringify({ role: 'user', content: userText }),
                JSON.stringify({ role: 'assistant', content: botMessageJSON.error })
              ]
            }
          }
        })
        return
      }

      // Find if month and year exists
      const statement = await prisma.statement.findFirst({
        where: {
          month: botMessageJSON.month,
          year: botMessageJSON.year
        }
      })

      if (!statement) {
        // create statement
        const newStatement = await prisma.statement.create({
          data: {
            month: botMessageJSON.month,
            year: botMessageJSON.year
          }
        })

        if (user.statementIdSet) {
          // get prev categories and incomes
          const prevStatement = await prisma.statement.findUnique({
            where: {
              id: user.statementIdSet
            },
            select: {
              categories: true,
              incomes: true
            }
          })

          if (prevStatement) {
            await prisma.statement.update({
              where: {
                id: newStatement.id
              },
              data: {
                categories: {
                  createMany: {
                    data: prevStatement.categories.map(c => ({
                      currency: c.currency,
                      debt: c.debt,
                      description: c.description,
                      limit: c.limit,
                      dueDate: c.dueDate,
                      notes: c.notes
                    }))
                  }
                },
                incomes: {
                  createMany: {
                    data: prevStatement.incomes.map(i => ({
                      amount: i.amount,
                      currency: i.currency,
                      source: i.source
                    }))
                  }
                }
              }
            })
          }
        }

        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            statementIdSet: newStatement.id,
            chatHistory: [],
            chatSubject: '',
            chatSubSubject: ''
          }
        })

        await bot.sendMessage(msg.chat.id, 'Estado de cuenta creado correctamente.')
        return
      }

      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          statementIdSet: statement.id,
          chatHistory: [],
          chatSubject: '',
          chatSubSubject: ''
        }
      })

      await bot.sendMessage(msg.chat.id, 'Estado de cuenta encontrado.')

      await bot.sendMessage(msg.chat.id, botMessage)
    }
  }

  if (userText === '/categoria') {
    bot.sendChatAction(msg.chat.id, 'typing')

    if (!user.statementIdSet) {
      await bot.sendMessage(msg.chat.id, 'Primero debes crear un estado de cuenta.\nUsa /estado para crear uno.')
      return
    }
  }
})