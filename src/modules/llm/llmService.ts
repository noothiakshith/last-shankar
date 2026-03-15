import prisma from '@/lib/prisma';
import { Mistral } from '@mistralai/mistralai';

const apiKey = process.env.MISTRAL_API_KEY || '';
const client = apiKey ? new Mistral({ apiKey }) : null;

export class LLMService {
  /**
   * Summarize a workflow run by fetching the run, events, and pending gates,
   * then composing a natural language string.
   */
  async summarizeWorkflow(runId: string): Promise<string> {
    const workflow = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        events: {
          orderBy: { occurredAt: 'desc' },
          take: 5
        },
        approvals: {
          where: { status: 'PENDING' }
        }
      }
    });

    if (!workflow) {
      throw new Error(`Workflow run ${runId} not found`);
    }

    const pendingGateMsg = workflow.approvals.length > 0 
      ? `There are currently ${workflow.approvals.length} pending approval gates (e.g., ${workflow.approvals[0].gateType} requires ${workflow.approvals[0].requiredRole}).` 
      : 'There are no pending approvals.';

    let recentEventsMsg = 'No recent events.';
    if (workflow.events.length > 0) {
      const eventStrs = workflow.events.map(e => `- [${e.eventType}] transitioned from ${e.fromState} to ${e.toState}`);
      recentEventsMsg = `Recent events:\n${eventStrs.join('\n')}`;
    }

    const compiledData = `Workflow Run ID: ${workflow.id}\nType: ${workflow.type}\nStatus: ${workflow.state}\nTriggered By: ${workflow.triggeredBy} on ${workflow.createdAt.toISOString()}\n\nApprovals Info: ${pendingGateMsg}\n\n${recentEventsMsg}`;

    if (client) {
      try {
        const response = await client.chat.complete({
          model: 'mistral-large-latest',
          messages: [
            { role: 'system', content: 'You are an intelligent ERP system assistant. Your job is to summarize workflow executions concisely for executive dashboards.' },
            { role: 'user', content: `Please provide a clean, 2-3 sentence executive summary for the following workflow run data:\n\n${compiledData}` }
          ],
        });
        if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
            return response.choices[0].message.content as string;
        }
      } catch (e) {
        console.error("Mistral generation failed in summarizeWorkflow:", e);
        // gracefully fallback through to template
      }
    }

    // Template fallback
    return `[TEMPLATE FALLBACK] Workflow Run (${workflow.id}) of type ${workflow.type} is currently in state ${workflow.state}. ` +
           `${pendingGateMsg}\n\n${recentEventsMsg}\n\n` +
           `It was triggered by ${workflow.triggeredBy} on ${workflow.createdAt.toISOString()}.`;
  }

  /**
   * Explain a forecast result by fetching the result and its model,
   * then composing a natural language description.
   */
  async explainForecast(forecastId: string): Promise<string> {
    const forecast = await prisma.forecastResult.findUnique({
      where: { id: forecastId }
    });

    if (!forecast) {
      throw new Error(`Forecast ${forecastId} not found`);
    }

    const model = await prisma.trainedModel.findUnique({
      where: { id: forecast.modelId }
    });

    if (!model) {
      throw new Error(`Trained model ${forecast.modelId} not found`);
    }

    const predictionsStr = typeof forecast.predictions === 'object' 
      ? JSON.stringify(forecast.predictions) 
      : String(forecast.predictions);

    const compiledData = `Forecast Request for Product ${forecast.productId} in Region ${forecast.region}:\n` +
      `Horizon: ${forecast.horizon} days\nStatus: ${forecast.status}\n` +
      `Model Used: ${model.modelType} (MAE: ${model.mae.toFixed(2)}, R²: ${model.r2Score.toFixed(2)})\n` +
      `Raw Predictions Output: ${predictionsStr}`;

    if (client) {
      try {
        const response = await client.chat.complete({
          model: 'mistral-large-latest',
          messages: [
            { role: 'system', content: 'You are an analytics assistant serving a sales dashboard. Provide a brief, easy-to-read explanation of forecast results based on structured data.' },
            { role: 'user', content: `Please interpret this AI sales forecast logic to a business user in a short paragraph:\n\n${compiledData}` }
          ],
        });
        if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
            return response.choices[0].message.content as string;
        }
      } catch (e) {
        console.error("Mistral generation failed in explainForecast:", e);
        // gracefully fallback through to template
      }
    }

    // Template fallback
    return `[TEMPLATE FALLBACK] ${compiledData}`;
  }
}

export const llmService = new LLMService();
