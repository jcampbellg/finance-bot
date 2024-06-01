import { Category, Income, Statement, Transaction } from '@prisma/client'
import openAi from '@utils/openAi'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import { ChatCompletionMessageParam } from 'openai/resources'

type ErrorJSON = {
  error: string
  reset?: boolean
}

type StatementJSON = Pick<Statement, 'month' | 'year'>

type IncomeJSON = Omit<Income, 'id' | 'createdAt' | 'updatedAt' | 'statementId'>

type TransactionJSON = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'categoryId' | 'chatId'> & { category: string }

type CategoryJSON = {
  category: string
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

  if ('error' in botMessageJSON) {
    return botMessageJSON
  }

  return {
    ...botMessageJSON,
    amount: parseFloat(botMessageJSON.amount.toString())
  }
}

export async function AIAmount(amount: string): Promise<Pick<IncomeJSON, 'amount'> | ErrorJSON> {
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
      content: `Your job is to get a amount from the user.`
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

  if ('error' in botMessageJSON) {
    return botMessageJSON
  }

  return {
    ...botMessageJSON,
    amount: parseFloat(botMessageJSON.amount.toString())
  }
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

  if ('error' in botMessageJSON) {
    return botMessageJSON
  }

  return {
    ...botMessageJSON,
    amount: parseFloat(botMessageJSON.amount.toString())
  }
}

export async function AITransaction(allCategories: Category[], userReply: string, history: ChatCompletionMessageParam[]): Promise<TransactionJSON | ErrorJSON> {
  const today = dayjs().tz(process.env.timezone).format('YYYY-MM-DD HH:mm:ss')

  const botAI = await openAi.chat.completions.create({
    messages: [{
      role: 'system',
      content: `Today is: ${today}`
    }, {
      role: 'system',
      content: 'The conversation is in spanish.'
    }, {
      role: 'system',
      content: 'Your job is to get the date, description, category name, payment method, expense or income, amount and currency of a transaction from the user input. Notes are optionals.'
    }, {
      role: 'system',
      content: 'The type will be INCOME or EXPENSE. If the user does not provide this information, you will assume it is an expense.'
    }, {
      role: 'system',
      content: 'Income is also deposito or ingreso, and expense is also gasto.'
    }, {
      role: 'system',
      content: `You will get the category name from this list: [${allCategories.map(c => c.description).join(', ')}]`
    }, {
      role: 'system',
      content: 'The date will be in the format YYYY-MM-DD HH:mm:ss. If no date is provided, use the current date.'
    }, {
      role: 'system',
      content: 'The amount will always be a positive value. Remove the negative sign if it is present.'
    }, {
      role: 'system',
      content: `The currency can be HNL (the user can type L, Lempiras or HNL) or USD (the user can type as $ or Dollars).`
    }, {
      role: 'system',
      content: 'If the message contains "FICO: Transaccion TC xxxx*2928 por 213 en" you will not include this in the description. And the payment method will be CREDITCARD.'
    }, {
      role: 'system',
      content: 'You will return these data in JSON format: { "date": "YYYY-MM-DD HH:mm:ss", "paymentMethod": "CASH || CREDITCARD || DEBITCARD || TRANSFER", "category": "Category Name" "description": "description", "amount": "amount", "currency": "USD or HNL", "type": "INCOME or EXPENSE" "notes": "return empty string if none" }'
    }, {
      role: 'system',
      content: 'If you cannot find payment method, description, amount and currency, return a json with error message explaining what you need: { "error": "error message" }'
    }, {
      role: 'system',
      content: 'If the user says "cancel" or "cancelar" you will return a json with reset: true'
    }, ...history, {
      role: 'user',
      content: userReply
    }],
    model: 'gpt-4-1106-preview',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 300
  })
  const botMessage = botAI.choices[0].message.content?.trim() || '{"error": "No se pudo procesar la información.", "reset": true}'
  const botMessageJSON: TransactionJSON | ErrorJSON = JSON.parse(botMessage)

  if ('error' in botMessageJSON) {
    return botMessageJSON
  }

  return {
    ...botMessageJSON,
    amount: parseFloat(botMessageJSON.amount.toString())
  }
}

export async function AICategory(allCategories: Category[], userReply: string): Promise<CategoryJSON | ErrorJSON> {
  const botAI = await openAi.chat.completions.create({
    messages: [{
      role: 'system',
      content: 'The conversation is in spanish.'
    }, {
      role: 'system',
      content: 'Your job is to get the category name the user is trying to find.'
    }, {
      role: 'system',
      content: `You will get the category name from this list: [${allCategories.map(c => c.description).join(", ")}]`
    }, {
      role: 'system',
      content: 'Don\'t be to strict with the user input, try to match the category name as best as you can.'
    }, {
      role: 'system',
      content: 'You will return these data in JSON format: { "category": "Category Name based on the list" } or { "error": "error message" }'
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
  const botMessageJSON: CategoryJSON | ErrorJSON = JSON.parse(botMessage)

  return botMessageJSON
}