import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

type ErrorJSON = {
  error: string
  reset?: boolean
}

type StatementJSON = {
  month: number
  year: number
}

type IncomeJSON = {
  amount: number
  currency: 'HNL' | 'USD'
  source: string
}

export async function AIStatement(userReply: string): Promise<StatementJSON | ErrorJSON> {
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')

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
    }, {
      role: 'user',
      content: userReply
    }],
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300
  })

  const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
  const botMessageJSON: StatementJSON | ErrorJSON = JSON.parse(botMessage)

  return botMessageJSON
}

export async function AISaveIncome(source: string, amount: string): Promise<IncomeJSON | ErrorJSON> {
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')

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
    }, {
      role: 'assistant',
      content: '¿Cuál es la fuente de tu ingreso?'
    }, {
      role: 'user',
      content: source
    }, {
      role: 'assistant',
      content: '¿Cuánto es el ingreso?'
    }, {
      role: 'user',
      content: amount
    }],
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300
  })
  const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
  const botMessageJSON: IncomeJSON | ErrorJSON = JSON.parse(botMessage)

  return botMessageJSON
}

export async function AIEditIncome(amount: string): Promise<Pick<IncomeJSON, 'amount'> | ErrorJSON> {
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')

  const botAI = await openAi.chat.completions.create({
    messages: [{
      role: 'system',
      content: `Today is: ${today}`
    }, {
      role: 'system',
      content: 'Reply in spanish'
    }, {
      role: 'system',
      content: `Your job is to get amount of the income from the user.`
    }, {
      role: 'system',
      content: 'You will return these data in JSON format: { "amount": <amount in number>} or { "error": "error message" }'
    }, {
      role: 'user',
      content: amount
    }],
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300
  })
  const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
  const botMessageJSON: Pick<IncomeJSON, 'amount'> | ErrorJSON = JSON.parse(botMessage)

  return botMessageJSON
}

export async function AIAmountAndCurrency(userReply: string): Promise<Omit<IncomeJSON, 'source'> | ErrorJSON> {
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')

  const botAI = await openAi.chat.completions.create({
    messages: [{
      role: 'system',
      content: `Today is: ${today}`
    }, {
      role: 'system',
      content: 'Reply in spanish'
    }, {
      role: 'system',
      content: `Your job is to get a amount and currency from the user.`
    }, {
      role: 'system',
      content: `The currency can be HNL (the user can type L, Lempiras or HNL) or USD (the user can type as $ or Dollars).`
    }, {
      role: 'system',
      content: 'You will return these data in JSON format: { "amount": <amount in number>, "currency": "HNL" or "USD" } or { "error": "error message" }'
    }, {
      role: 'user',
      content: userReply
    }],
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300
  })
  const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
  const botMessageJSON: Omit<IncomeJSON, 'source'> | ErrorJSON = JSON.parse(botMessage)

  return botMessageJSON
}