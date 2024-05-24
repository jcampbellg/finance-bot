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

type IncomeJSON = {
  amount: number
  currency: 'HNL' | 'USD'
  source: string
} | {
  error: string
  reset?: boolean
}

type CategoryJSON = {
  description: string
  budget: number
  currency: 'HNL' | 'USD'
  isFixed: boolean
  dueDate?: number
  notes: string
} | {
  error: string
  reset?: boolean
}

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
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')
  const conversion = await prisma.conversion.findFirst()
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
    try {
      const json = JSON.parse(s)
      return {
        role: json.role as 'assistant' | 'user' | 'system',
        content: json.content as string
      }
    } catch (error) {
      return {
        role: 'system' as 'assistant' | 'user' | 'system',
        content: s
      }
    }
  }) || []

  if (userText === '/ingreso') {
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
    if (user.chatSubSubject === 'view') {
      if (userText.startsWith('/')) {
        try {
          const index = parseInt(userText.replace('/', '')) - 1
          const incomeSelected = await prisma.income.findFirst({
            skip: index,
            where: {
              statementId: user.statementIdSet as string
            }
          })

          if (!incomeSelected) {
            await bot.sendMessage(msg.chat.id, 'No se encontró el ingreso.')
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
            return
          }

          await prisma.income.delete({
            where: {
              id: incomeSelected.id
            }
          })
          await bot.sendMessage(msg.chat.id, 'Ingreso eliminado correctamente.')
        } catch (error) {
          await bot.sendMessage(msg.chat.id, 'No se pudo eliminar el ingreso. Inténtalo de nuevo.')
        }

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

        const incomes = await prisma.income.findMany({
          where: {
            statementId: user.statementIdSet as string
          }
        })

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
      const botMessageJSON: IncomeJSON = JSON.parse(botMessage)

      if ('reset' in botMessageJSON) {
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatSubject: '',
            chatSubSubject: '',
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

      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          chatSubject: '',
          chatSubSubject: '',
          chatHistory: []
        }
      })

      const newIncome = await prisma.income.create({
        data: {
          statementId: user.statementIdSet as string,
          amount: botMessageJSON.amount,
          currency: botMessageJSON.currency,
          source: botMessageJSON.source,
        }
      })

      await bot.sendMessage(msg.chat.id, `Ingreso ${newIncome.source}, creado correctamente.`)
    }
  }

  if (userText === '/estado') {
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
            chatSubject: '',
            chatSubSubject: '',
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
                      description: c.description,
                      budget: c.budget,
                      isFixed: c.isFixed,
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

        const monthInSpanish = dayjs().locale('es').month(newStatement?.month - 1).format('MMMM')
        const year = newStatement?.year

        await bot.sendMessage(msg.chat.id, 'Estado de cuenta creado correctamente.')
        await bot.sendMessage(msg.chat.id, `Estado de cuenta actual: ${monthInSpanish} ${year}`)
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

      const monthInSpanish = dayjs().locale('es').month(statement?.month - 1).format('MMMM')
      const year = statement?.year
      await bot.sendMessage(msg.chat.id, 'Estado de cuenta encontrado.')
      await bot.sendMessage(msg.chat.id, `Estado de cuenta actual: ${monthInSpanish} ${year}`)
    }
  }

  if (userText === '/categoria') {
    if (!user.statementIdSet) {
      await bot.sendMessage(msg.chat.id, 'Primero debes crear un estado de cuenta.\nUsa /estado para crear uno.')
      return
    }

    await prisma.user.update({
      where: {
        chatId: msg.chat.id
      },
      data: {
        chatSubject: 'category',
        chatSubSubject: 'ask',
        chatHistory: []
      }
    })
    await bot.sendMessage(msg.chat.id, '¿Que deseas hacer?\n/crear una categoria\n/ver tus categorias')
    return
  }

  if (user.chatSubject === 'category') {
    if (userText === '/crear') {
      const botReply = '¿Cuál es la descripción de la categoría?'
      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          chatSubSubject: 'create-description',
          chatHistory: {
            push: [JSON.stringify({ role: 'assistant', content: botReply })]
          }
        }
      })
      await bot.sendMessage(msg.chat.id, botReply)
      return
    }

    if (userText === '/ver') {
      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          chatHistory: [],
          chatSubSubject: 'view'
        }
      })

      const categories = await prisma.category.findMany({
        where: {
          statementId: user.statementIdSet as string
        }
      })

      if (categories.length === 0) {
        await bot.sendMessage(msg.chat.id, 'No tienes categorías registradas.')
        return
      }

      const categoriesText = categories.map((category, i) => {
        return `/${i + 1}. <b>${category.description}</b>\n${numeral(category.budget).format('0,0.00')} ${category.currency}`
      }).join('\n\n')

      await bot.sendMessage(msg.chat.id, `Presiona el /# para editar o eliminar.\n\n${categoriesText}`, { parse_mode: 'HTML' })
    }

    if (user.chatSubSubject === 'view') {
      if (userText.startsWith('/')) {
        try {
          const index = parseInt(userText.replace('/', '')) - 1
          const category = await prisma.category.findFirst({
            skip: index,
            where: {
              statementId: user.statementIdSet as string
            }
          })

          if (!category) {
            await bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
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
            return
          }

          await prisma.user.update({
            where: {
              chatId: msg.chat.id
            },
            data: {
              chatHistory: [JSON.stringify({ role: 'system', content: category.id })],
              chatSubSubject: 'view-ask'
            }
          })
          await bot.sendMessage(msg.chat.id, `<b>${category.description}</b>\n${numeral(category.budget).format('0,0.00')} ${category.currency}\nFija: ${category.isFixed ? `Si\nCada ${category.dueDate}` : 'No'}${category.notes ? `\n<blockquote>${category.notes}</blockquote>` : ''}\n\n/eliminar\n/editar`, { parse_mode: 'HTML' })
        } catch (error) {
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
          await bot.sendMessage(msg.chat.id, 'Ocurrió un error. Inténtalo de nuevo.')
        }
      }
    }

    if (user.chatSubSubject === 'view-ask') {
      if (userText === '/eliminar') {
        try {
          await prisma.category.delete({
            where: {
              id: chatHistory[0].content
            }
          })

          await bot.sendMessage(msg.chat.id, 'Categoría eliminada correctamente.')
        } catch (error) {
          await bot.sendMessage(msg.chat.id, 'No se pudo eliminar la categoría. Inténtalo de nuevo.')
        }

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
        return
      }

      if (userText === '/editar') {
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatSubSubject: 'edit',
          }
        })

        const categorySelected = await prisma.category.findUnique({
          where: {
            id: chatHistory[0].content
          }
        })

        await bot.sendMessage(msg.chat.id, `¿Que quieres editar?\n/descripcion\n/presupuesto${categorySelected?.isFixed ? '\n/fecha de pago' : ''}\n/notas`)
        return
      }
    }

    if (user.chatSubSubject.startsWith('edit') && user.chatSubSubject !== 'edit') {
      const category = await prisma.category.findUnique({
        where: {
          id: chatHistory[0].content
        }
      })

      if (!category) {
        await bot.sendMessage(msg.chat.id, 'No se encontró la categoría.')
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
        return
      }

      switch (user.chatSubSubject) {
        case 'edit-description':
          await prisma.category.update({
            where: {
              id: category.id
            },
            data: {
              description: userText
            }
          })
          await bot.sendMessage(msg.chat.id, 'Descripción editada correctamente.')
          break
        case 'edit-budget':
          await prisma.category.update({
            where: {
              id: category.id
            },
            data: {
              budget: parseFloat(userText)
            }
          })
          await bot.sendMessage(msg.chat.id, 'Presupuesto editado correctamente.')
          break
        case 'edit-dueDate':
          await prisma.category.update({
            where: {
              id: category.id
            },
            data: {
              dueDate: parseInt(userText)
            }
          })
          await bot.sendMessage(msg.chat.id, 'Fecha de pago editada correctamente.')
          break
        case 'edit-notes':
          await prisma.category.update({
            where: {
              id: category.id
            },
            data: {
              notes: userText
            }
          })
          await bot.sendMessage(msg.chat.id, 'Presupuesto editado correctamente.')
          break
      }

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
    }

    if (user.chatSubSubject === 'edit') {
      let botReply = ''
      let subSubject = ''

      switch (userText) {
        case '/descripcion':
          botReply = '¿Cuál es la nueva descripción de la categoría?'
          subSubject = 'edit-description'
          break
        case '/presupuesto':
          botReply = '¿Cuál es el nuevo presupuesto de la categoría?'
          subSubject = 'edit-budget'
          break
        case '/fecha':
          botReply = '¿Cuál es la fecha de vencimiento?'
          subSubject = 'edit-dueDate'
          break
        case '/notas':
          botReply = 'Agrega alguna nota adicional.'
          subSubject = 'edit-notes'
          break
        default:
          botReply = 'No se reconoce la opción.'
          subSubject = 'edit'
          break
      }

      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          chatSubSubject: subSubject,
        }
      })

      await bot.sendMessage(msg.chat.id, botReply)
      return
    }

    if (user.chatSubSubject === 'create-description') {
      const botReply = '¿Cuál es el presupuesto y su moneda de la categoría?'
      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          chatSubSubject: 'create-budget',
          chatHistory: {
            push: [
              JSON.stringify({ role: 'user', content: userText }),
              JSON.stringify({ role: 'assistant', content: botReply }),
            ]
          }
        }
      })

      await bot.sendMessage(msg.chat.id, botReply)
      return
    }

    if (user.chatSubSubject === 'create-budget') {
      const botReply = '¿Es un gasto fijo? Si lo es, ¿cuál es la fecha de vencimiento?'
      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          chatSubSubject: 'create-isFixed',
          chatHistory: {
            push: [
              JSON.stringify({ role: 'user', content: userText }),
              JSON.stringify({ role: 'assistant', content: botReply }),
            ]
          }
        }
      })

      await bot.sendMessage(msg.chat.id, botReply)
      return
    }

    if (user.chatSubSubject === 'create-isFixed') {
      const botReply = 'Agrega alguna nota adicional.'
      await prisma.user.update({
        where: {
          chatId: msg.chat.id
        },
        data: {
          chatSubSubject: 'create-end',
          chatHistory: {
            push: [
              JSON.stringify({ role: 'user', content: userText }),
              JSON.stringify({ role: 'assistant', content: botReply }),
            ]
          }
        }
      })

      await bot.sendMessage(msg.chat.id, botReply)
      return
    }

    if (user.chatSubSubject === 'create-end') {
      const botAI = await openAi.chat.completions.create({
        messages: [{
          role: 'system',
          content: `Today is: ${today}`
        }, {
          role: 'system',
          content: 'Reply in spanish'
        }, {
          role: 'system',
          content: `Your job is to get category description, budget amount, currency, isFixed, dueDate and notes from the user.`
        }, {
          role: 'system',
          content: `The currency can be HNL (the user can type L, Lempiras or HNL) or USD (the user can type as $ or Dollars).`
        }, {
          role: 'system',
          content: 'You will return these data in JSON format: { "description": <description>, "budget": <amount>, "currency": "HNL" or "USD", "isFixed": <true | false>, "dueDate": <if isFixed is true, from 0 to 31>, "notes": <notes or empty string> } or { "error": "error message" }'
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
      const botMessageJSON: CategoryJSON = JSON.parse(botMessage)

      if ('reset' in botMessageJSON) {
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatSubject: '',
            chatSubSubject: '',
            chatHistory: []
          }
        })

        await bot.sendMessage(msg.chat.id, 'No se pudo procesar la información. Inténtalo de nuevo.')
        return
      }

      if ('error' in botMessageJSON) {
        await bot.sendMessage(msg.chat.id, `${botMessageJSON.error}\nInténtalo de nuevo con /categoria.`)
        await prisma.user.update({
          where: {
            chatId: msg.chat.id
          },
          data: {
            chatSubject: '',
            chatSubSubject: '',
            chatHistory: []
          }
        })
        return
      }

      try {
        const newCategory = await prisma.category.create({
          data: {
            description: botMessageJSON.description,
            budget: botMessageJSON.budget,
            currency: botMessageJSON.currency,
            isFixed: botMessageJSON.isFixed,
            dueDate: botMessageJSON.dueDate,
            notes: botMessageJSON.notes || '',
            statementId: user.statementIdSet as string
          }
        })
        await bot.sendMessage(msg.chat.id, `Categoría ${newCategory.description}, creada correctamente.`)
        return
      } catch (error) {
        await bot.sendMessage(msg.chat.id, 'No se pudo crear la categoría. Inténtalo de nuevo.')
        return
      }
    }
  }
})