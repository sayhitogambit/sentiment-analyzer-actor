# AI Sentiment Analyzer - OpenRouter

Analyze sentiment and emotions in text using advanced AI models. Perfect for brand monitoring, customer feedback analysis, and social listening.

## Features

- **Sentiment Classification**: Positive, negative, or neutral
- **Sentiment Scores**: -1.0 (very negative) to 1.0 (very positive)
- **Emotion Detection**: Joy, anger, sadness, fear with intensity scores
- **Batch Processing**: Analyze multiple texts efficiently
- **Multi-language Support**: Auto-detect or specify language
- **Summary Statistics**: Aggregate sentiment metrics

## Pricing

- **Cost**: $0.003 per 100 texts (using free model)
- **Charge**: $0.30 per 100 texts
- **Profit margin**: ~99%

## Input

```json
{
  "texts": ["Text 1", "Text 2", "Text 3"],
  "includeEmotions": true,
  "language": "auto",
  "model": "google/gemini-2.0-flash-exp:free",
  "openrouterApiKey": "sk-or-v1-..."
}
```

## Output

```json
{
  "results": [
    {
      "text": "This is amazing!",
      "sentiment": "positive",
      "score": 0.95,
      "confidence": 0.98,
      "emotions": {
        "joy": 0.92,
        "anger": 0.01,
        "sadness": 0.02,
        "fear": 0.01
      },
      "reasoning": "Highly positive language with strong enthusiasm"
    }
  ],
  "summary": {
    "total": 100,
    "positive": 65,
    "negative": 20,
    "neutral": 15,
    "averageScore": "0.325"
  }
}
```

## Use Cases

- Customer review analysis
- Social media monitoring
- Brand reputation management
- Product feedback analysis
- Survey response analysis
- Content moderation

## License

Apache-2.0
