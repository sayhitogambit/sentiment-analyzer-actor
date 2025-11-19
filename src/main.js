import { Actor } from 'apify';
import axios from 'axios';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL_PRICING = {
    'google/gemini-2.0-flash-exp:free': { input: 0, output: 0 },
    'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
    'openai/gpt-4o-mini': { input: 0.15, output: 0.60 }
};

await Actor.main(async () => {
    const input = await Actor.getInput();
    console.log('Input:', input);

    if (!input?.texts || !Array.isArray(input.texts) || input.texts.length === 0) {
        throw new Error('At least one text is required');
    }
    if (!input?.openrouterApiKey) {
        throw new Error('OpenRouter API key is required');
    }

    const {
        texts,
        includeEmotions = true,
        language = 'auto',
        model = 'google/gemini-2.0-flash-exp:free',
        openrouterApiKey
    } = input;

    console.log(`Analyzing sentiment for ${texts.length} texts using ${model}`);

    const results = [];
    let totalCost = 0;

    // Process texts in batches of 10
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} texts)...`);

        try {
            const batchResults = await analyzeSentimentBatch(
                batch,
                includeEmotions,
                language,
                model,
                openrouterApiKey
            );

            results.push(...batchResults.results);
            totalCost += batchResults.cost;

            console.log(`✓ Batch completed. Processed ${i + batch.length}/${texts.length} texts`);

        } catch (error) {
            console.error(`Error processing batch:`, error.message);
            throw error;
        }
    }

    // Calculate summary statistics
    const summary = calculateSummary(results);
    const chargePrice = 0.30; // $0.30 charge per 100 texts
    const actualCharge = Math.max(0.30, (texts.length / 100) * 0.30);

    // Save results
    await Actor.pushData({
        results,
        summary,
        statistics: {
            totalTexts: texts.length,
            model,
            includeEmotions,
            cost: parseFloat(totalCost.toFixed(6)),
            chargePrice: parseFloat(actualCharge.toFixed(2)),
            profit: parseFloat((actualCharge - totalCost).toFixed(4)),
            profitMargin: parseFloat(((actualCharge - totalCost) / actualCharge * 100).toFixed(2)),
            processedAt: new Date().toISOString()
        }
    });

    console.log('✓ Sentiment analysis completed!');
    console.log(`  Total texts: ${texts.length}`);
    console.log(`  Positive: ${summary.positive} (${summary.positivePercentage}%)`);
    console.log(`  Negative: ${summary.negative} (${summary.negativePercentage}%)`);
    console.log(`  Neutral: ${summary.neutral} (${summary.neutralPercentage}%)`);
    console.log(`  Average score: ${summary.averageScore}`);
    console.log(`  Cost: $${totalCost.toFixed(6)}`);
    console.log(`  Charge: $${actualCharge.toFixed(2)}`);
});

async function analyzeSentimentBatch(texts, includeEmotions, language, model, apiKey) {
    const prompt = `Analyze the sentiment of the following texts. For each text, provide:
1. Overall sentiment: "positive", "negative", or "neutral"
2. Sentiment score: -1.0 (very negative) to 1.0 (very positive)
3. Confidence level: 0 to 1
${includeEmotions ? '4. Emotion breakdown with scores 0-1: joy, anger, sadness, fear' : ''}

${language !== 'auto' ? `Language: ${language}\n` : ''}
Texts to analyze:
${texts.map((text, i) => `${i + 1}. "${text}"`).join('\n')}

Return ONLY a valid JSON object with this exact structure:
{
  "results": [
    {
      "text": "original text",
      "sentiment": "positive|negative|neutral",
      "score": -1.0 to 1.0,
      "confidence": 0 to 1,
      ${includeEmotions ? '"emotions": {"joy": 0-1, "anger": 0-1, "sadness": 0-1, "fear": 0-1},' : ''}
      "reasoning": "brief explanation"
    }
  ]
}`;

    const result = await callOpenRouter(prompt, model, apiKey);
    const parsed = JSON.parse(result.content);
    const cost = calculateCost(result.usage, model);

    return {
        results: parsed.results,
        cost: cost.totalCost
    };
}

async function callOpenRouter(prompt, model, apiKey, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.post(
                OPENROUTER_API_URL,
                {
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert sentiment analysis system. Provide accurate sentiment scores and emotion detection. Always return valid JSON only.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000,
                    response_format: { type: 'json_object' }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://apify.com',
                        'X-Title': 'Apify Sentiment Analyzer',
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            return {
                content: response.data.choices[0].message.content,
                usage: response.data.usage
            };

        } catch (error) {
            if (error.response?.status === 429 && attempt < maxRetries) {
                const retryAfter = parseInt(error.response.headers['retry-after'] || '5');
                console.log(`Rate limited. Waiting ${retryAfter}s...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }
            if (error.response?.status === 401) {
                throw new Error('Invalid OpenRouter API key');
            }
            if (error.response?.status >= 500 && attempt < maxRetries) {
                const backoff = Math.pow(2, attempt) * 1000;
                console.log(`Server error. Retrying in ${backoff}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                continue;
            }
            throw error;
        }
    }
}

function calculateCost(usage, model) {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['google/gemini-2.0-flash-exp:free'];
    const inputCost = (usage.prompt_tokens / 1000000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000000) * pricing.output;
    return {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost
    };
}

function calculateSummary(results) {
    const total = results.length;
    const positive = results.filter(r => r.sentiment === 'positive').length;
    const negative = results.filter(r => r.sentiment === 'negative').length;
    const neutral = results.filter(r => r.sentiment === 'neutral').length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / total;

    return {
        total,
        positive,
        negative,
        neutral,
        positivePercentage: ((positive / total) * 100).toFixed(1),
        negativePercentage: ((negative / total) * 100).toFixed(1),
        neutralPercentage: ((neutral / total) * 100).toFixed(1),
        averageScore: avgScore.toFixed(3)
    };
}
