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
   * Explain a forecast result or model performance.
   * If forecastId is provided, explain that specific result.
   * If it's not found, check if it's a model ID and explain the model's overall health.
   */
  async explainForecast(id: string): Promise<string> {
    let forecast = await prisma.forecastResult.findUnique({
      where: { id: id }
    });

    let model;
    if (forecast) {
      model = await prisma.trainedModel.findUnique({
        where: { id: forecast.modelId }
      });
    } else {
      // Check if the ID provided is actually a model ID
      model = await prisma.trainedModel.findUnique({
        where: { id: id }
      });
      if (model) {
        // Find the latest forecast for this model to give some context
        forecast = await prisma.forecastResult.findFirst({
          where: { modelId: model.id },
          orderBy: { generatedAt: 'desc' }
        });
      }
    }

    if (!model) {
      throw new Error(`Model or Forecast with ID ${id} not found`);
    }

    const predictionsStr = forecast 
      ? (typeof forecast.predictions === 'object' ? JSON.stringify(forecast.predictions) : String(forecast.predictions))
      : 'No recent predictions available.';

    const compiledData = `Analysis for Product ${model.productId} in Region ${model.region}:\n` +
      `Model Type: ${model.modelType}\n` +
      `Performance Metrics: MAE=${model.mae.toFixed(2)}, R²=${model.r2Score.toFixed(2)}\n` +
      (forecast ? `Recent Forecast Status: ${forecast.status}\nHorizon: ${forecast.horizon} days\nLatest Predictions: ${predictionsStr}` : `No specific forecast results yet.`);

    if (client) {
      try {
        const response = await client.chat.complete({
          model: 'mistral-large-latest',
          messages: [
            { role: 'system', content: 'You are an analytics assistant serving a sales dashboard. Provide a brief, easy-to-read explanation of AI model performance and forecast results.' },
            { role: 'user', content: `Please interpret this AI model/forecast data for a business user in a concise paragraph (2-3 sentences):\n\n${compiledData}` }
          ],
        });
        if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
            return response.choices[0].message.content as string;
        }
      } catch (e) {
        console.error("Mistral generation failed in explainForecast:", e);
      }
    }

    // Template fallback
    return `[ANALYSIS] Product ${model.productId} (${model.region}) using ${model.modelType}. ` +
           `Accuracy is rated at ${(model.r2Score * 100).toFixed(1)}% with an error margin of ${model.mae.toFixed(2)}. ` +
           (forecast ? `Latest forecast is currently in ${forecast.status} state.` : `Model is ready for deployment.`);
  }
}

export const llmService = new LLMService();
